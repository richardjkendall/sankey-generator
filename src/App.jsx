import { useEffect, useRef, useState } from 'react'
import './App.css'
import styled from 'styled-components'

import Sankey from './Sankey' 
import InjectContainerSize from './InjectContainerSize'

import { parse } from 'dotparser-normalized'
import Editor from 'react-simple-code-editor'
import { highlight, languages } from 'prismjs/components/prism-core'

import 'prismjs/components/prism-dot'
import 'prismjs/themes/prism.css'

const config = `graph ms {
  subgraph products {
    label = "Product Lines";
    ProdBus [label="Productivity & Business"];
    Cloud [label="Intelligent Cloud"];
    Personal [label="Personal Computing"];
  }
  
  subgraph revenue {  
    label = "Revenue";
    Revenue [label="Revenue"];
  }

  subgraph buckets {
    label = "Buckets";
    GrossProfit [label="Gross Profit"];
    CostOfRevenue [label="Cost of Revenue"];
  }

  subgraph buckets2 {
    label = "Buckets 2";

    OpProfit [label="Operating Profit"];
    OpEx [label="Operating Expenses"];
    ProdCost [label="Product Costs"];
    ServCost [label="Service Costs"];
  }

  subgraph buckets3 {
    label = "Buckets 3";
   
    NetProfit [label="Net Profit"];
    Tax [label="Tax"];
    Other [label="Other Expenses"];

    RandD [label="R&D"];
    SandM [label="Sales & Marketing"];
    GandA [label="General & Admin"];
  }

  ProdBus -- Revenue [weight=28.3];
  Cloud -- Revenue [weight=24.1];
  Personal -- Revenue [weight=13.2];

  Revenue -- GrossProfit [weight=45.5];
  Revenue -- CostOfRevenue [weight=20.1];

  GrossProfit -- OpProfit [weight=30.6];
  GrossProfit -- OpEx [weight=14.9];
  CostOfRevenue -- ProdCost [weight=3.3];
  CostOfRevenue -- ServCost [weight=16.8];

  OpProfit -- NetProfit [weight=24.7];
  OpProfit -- Tax [weight=5.6];
  OpProfit -- Other [weight=0.3];

  OpEx -- RandD [weight=7.5];
  OpEx -- SandM [weight=5.7];
  OpEx -- GandA [weight=1.7];
}
`;

const CodeContainer = styled.div`
  max-height: 500px;
  overflow-y: auto;
  width: 100%;
  border: 1px solid black;

  .editor {
    counter-reset: line;
    border: 1px solid #ced4da;
  }

  .editor #codeArea {
    outline: none;
    padding-left: 60px !important;
  }

  .editor pre {
    padding-left: 60px !important;
  }

  .editor .editorLineNumber {
    position: absolute;
    left: 0px;
    color: #cccccc;
    text-align: right;
    width: 40px;
    font-weight: 100;
  }

`;

const ErrorContainer = styled.div`
  background-color: #FAA0A0;
  padding: 5px;
  border-left: 5px solid #DC143C;
  margin-top: 5px;
  margin-bottom: 5px;
  
  p {
    margin: 0;
    color: #DC143C;  
  }
`;

const UILayout = styled.div`
  display: flex;
  flex-direction: row;
  flex-wrap: nowrap;
  align-items: flex-start;
`;

const UIEditorSection = styled.div`
  order: 1;
  flex-grow: 0;
  width: 450px;

  button {
    margin-bottom: 10px;
  }
`;

const UISankeySection = styled.div`
  order: 2;
  flex-grow: 1;
  height: 620px;
  width: calc(100% - 450px);
`;

const SettingsForm = styled.form`
  margin-top: 10px;

  input {
    margin-bottom: 5px;
  }

  label {
    display: inline-block;
    width: 200px;
  }
`;

function App() {
  const [liveCode, setLiveCode] = useState("");
  const [codeSnapshot, setCodeSnapshot] = useState("");
  const [parseError, setParseError] = useState({});

  const sankeyRef = useRef();
  const [sankeyData, setSankeyData] = useState({nodes: [], links: []});
  const [totals, setTotals] = useState([]);
  const [categories, setCategories] = useState([]);

  const [unitPrefix, setUnitPrefix] = useState("$");
  const [unitSuffix, setUnitSuffix] = useState("b");

  // original colours ["#fafa6e", "#2a4858"]
  // new first colour #f97193
  const [firstColour, setFirstColour] = useState("#fafa6e");
  const [secondColour, setSecondColour] = useState("#2a4858");
  const [nodeMargin, setNodeMargin] = useState(15);

  // on load, set the default config
  useEffect(() => {
    setLiveCode(config);
    setCodeSnapshot(config);
  }, []);

  // we need to parse the code when the snapshot changes
  useEffect(() => { 
    if(codeSnapshot === "") {
      return;
    }
    try {
      let ast = parse(codeSnapshot);
      console.log("ast", ast);
      setParseError({});
      if(validateGraph(ast)) {
        // we now need to draw the sankey from the parsed graph
        drawSankey(ast);
      } else {
        // if it failed validation we need to clear the sankey
        setSankeyData({nodes: [], links: []});
      }
    } catch(err) {
      console.log("error parsing", err);
      setParseError({
        message: err?.message,
        line: err?.location?.start?.line,
        column: err?.location?.start?.column
      })
      // clear sankey
      setSankeyData({nodes: [], links: []});
    }
  }, [codeSnapshot]);

  // validate the graph structure
  const validateGraph = (ast) => {
    // single graph
    if(ast.length !== 1) {  
      setParseError({
        message: "Only one graph allowed",
        line: 0,
        column: 0
      })
      return false;
    }
    // nodes must be subgraphs
    if(ast[0].nodes.filter(n => n.type !== "subgraph").length > 0) {
      setParseError({
        message: "All nodes must be subgraphs",
        line: 0,
        column: 0
      })
      return false;
    }
    // at least two subgraphs
    if(ast[0].nodes.length < 2) {
      setParseError({
        message: "At least two subgraphs required",
        line: 0,
        column: 0
      })
      return false;
    }
    // at least one edge
    if(ast[0].edges.length < 1) {
      setParseError({
        message: "At least one edge required",
        line: 0,
        column: 0
      });
    }
    // subgraphs should be labelled
    if(ast[0].nodes.filter(n => !n.attr.label).length > 0) {
      setParseError({
        message: "All subgraphs must be labelled",
        line: 0,
        column: 0
      });
      return false;
    }
    // nodes in subgraphs should be labelled
    if(ast[0].nodes.filter(n => n.nodes.filter(nn => !nn.attr.label).length > 0).length > 0) {
      setParseError({
        message: "All nodes in subgraphs must be labelled",
        line: 0,
        column: 0
      });
      return false;
    }
    // edges should have weights
    if(ast[0].edges.filter(e => !e.attr.weight).length > 0) {
      setParseError({
        message: "All edges must have weights",
        line: 0,
        column: 0
      });
      return false;
    }
    
    // if we got here then the graph is valid
    return true;
  }

  // draw sankey diagram
  const drawSankey = (ast) => {
    var sankeyLocal = {
      nodes: [],
      links: []
    };

    // get nodes first and then edges
    sankeyLocal.nodes = ast[0].nodes.map((c, i) => {
      return c.nodes.map(n => {
        return {
          name: n.id,
          displayName: n?.attr?.label,
          category: c.attr.label,
          layer: i,
          label: n?.attr?.comment
        }
      })

    }).reduce((p, c) => {
      return [...p, ...c];
    }, []);

    // run through links
    sankeyLocal.links = ast[0].edges.map(e => {
      return {
        source: sankeyLocal.nodes.findIndex(n => n.name === e.source),
        target: sankeyLocal.nodes.findIndex(n => n.name === e.target),
        value: e.attr.weight,
        originalValue: e.attr.weight
      }
    });

    // print to the console what we constructed
    console.log("drawSankey:", sankeyLocal);
    setSankeyData(sankeyLocal);
  }

  // summarise sankey data
  useEffect(() => {
    // we need to summarise the sankey data to check for correctness
    // first we need the list of categories
    /*if(sankeyData.nodes.length > 0 && sankeyData.links.length > 0) {
      let categories = sankeyData.nodes
        .map(node => node.category)
        .filter((value, index, self) => self.indexOf(value) === index);
      setCategories(categories);

      let totals = categories.map((cat, index) => {
        let total = sankeyData.links
          .filter(link => sankeyData.nodes[link.target].category === cat)
          .reduce((p, c) => {
            return p + c.value;
          }, 0);
        return total;
      });
      setTotals(totals);
    }*/
  }, [sankeyData])

  const hightlightWithLineNumbers = (input, language) =>
    highlight(input, language)
      .split("\n")
      .map((line, i) => `<span class='editorLineNumber'>${i + 1}</span>${line}`)
      .join("\n");

  return (
    <>
      <h1>Sankey Diagram Creator</h1>
      <UILayout>
        <UIEditorSection>
          <button onClick={() => {setCodeSnapshot(liveCode)}}>Draw</button>
          {parseError.message && <ErrorContainer>
            <p>{parseError.message}</p>
            <p>Line: {parseError.line}, Column: {parseError.column}</p>
          </ErrorContainer>}
          <CodeContainer>
            <Editor
              value={liveCode}
              onValueChange={code => setLiveCode(code)}
              padding={10}
              highlight={code => hightlightWithLineNumbers(code, languages.dot)}
              textareaId="codeArea"
              className="editor"
              style={{
                fontFamily: "monospace",
                fontSize: 12,
              }}
            />
          </CodeContainer>
          <SettingsForm>
            <label for="unitPrefix">Unit Prefix:</label>
            <input type="text" id="unitPrefix" name="unitPrefix" value={unitPrefix} onChange={e => setUnitPrefix(e.target.value)} /><br/>

            <label for="unitSuffix">Unit Suffix:</label>
            <input type="text" id="unitSuffix" value={unitSuffix} onChange={e => setUnitSuffix(e.target.value)} name="unitSuffix" /><br/>


            <label for="firstColour">First Colour:</label>
            <input type="color" id="firstColour" name="firstColour" value={firstColour} onChange={e => setFirstColour(e.target.value)} /><br/>

            <label for="secondColour">Second Colour:</label>
            <input type="color" id="secondColour" name="secondColour" value={secondColour} onChange={e => setSecondColour(e.target.value)} /><br/>

            <label for="nodeMargin">Node Margin:</label>
            <input type="range" id="nodeMargin" name="nodeMargin" value={nodeMargin} onChange={e => setNodeMargin(e.target.value)} min="10" max="50" />
          </SettingsForm>
        </UIEditorSection>
        <UISankeySection>
          {sankeyData.nodes.length > 0 && 
          <InjectContainerSize widthReducer={15}>
            <Sankey
              data={sankeyData}
              width={1050}
              height={600}
              margin={10}
              nodeMargin={nodeMargin}
              hideBlackhole={true}
              ref={sankeyRef}
              unitPrefix={unitPrefix}
              unitSuffix={unitSuffix}
              firstColour={firstColour}
              secondColour={secondColour}
            />
          </InjectContainerSize>
          }
        </UISankeySection>
      </UILayout>
      
      {/*<div>
        <ul>
          {totals.map((total, index) => (
            <li key={index}>{categories[index]}: {total}</li>
          ))}
        </ul>
      </div>*/}
      
    </>
  )
}

export default App
