import React, { Component } from 'react';
import PropTypes from "prop-types";
import NodeNavigator from "./NodeNavigator.js";
import { Button } from 'antd';
import {CSVLink, CSVDownload} from 'react-csv';

const ButtonGroup = Button.Group;
const cat = "categorical";
const seq = "sequential";
let d3 = require("d3");
let d3_chromatic = require("d3-scale-chromatic");
class Visualization extends Component {

 componentWillUpdate(newProps) {
    // console.log("NodeNavigatorComponent will update data.length=" + newProps.data.length);
    // if (newProps.data.length !== this.props.data.length)
    //   this.nn.data(newProps.data);
    if(newProps.exportData.length === this.props.exportData.length){
      this.setUpNodeNavigator();
    }
  }
  componentDidUpdate(){
    // this.setUpNodeNavigator();
  }
  setUpNodeNavigator = () => {
    console.log("NodeNavigatorComponent did mount");
    console.log(this.props.data, 'this.props.data nn')
    this.nn = new NodeNavigator(this.target, 600)
      // the next line is commented because the node navigator creates a sequential id 
      // .id(this.props.id)
      .updateCallback(this.props.updateCallback);
      // .addSequentialAttrib("Timestamp",
      //   d3.scalePow()
      //     .exponent(0.25)
      //     .range([d3_chromatic.interpolatePurples(0), d3_chromatic.interpolatePurples(1)]))
      // .addCategoricalAttrib("car-type")
      // .addCategoricalAttrib("gate-name");

      this.props.attributes.forEach((d,i)=>{
        if(d.checked){
        console.log(this.props.data)
        console.log("------------");

          if(d.type === cat){
            console.log('cat',d.name);
            this.nn.addCategoricalAttrib(d.name);
          }else if(d.type === seq){
            console.log('seq',d.name);
            if(d.data=== "date"){
              console.log('date')
              this.nn.addSequentialAttrib(d.name,
                        d3.scalePow()
                          .exponent(0.25)
                          .range([d3_chromatic.interpolatePurples(0), d3_chromatic.interpolatePurples(1)]))
            }
            else {
              this.nn.addSequentialAttrib(d.name);
            }
            
          }

         console.log("------------");
       }
      })

    if (this.props.data) {
      this.nn.data(this.props.data);
    }
  }
	componentDidMount() {
    this.props.setLoading(true);
    this.setUpNodeNavigator();
    
  }
  onClick = () => {
    this.props.setLoaded();
  }
  exportVisualization = () => {
    let nn = d3.select("#nodeNavigator");
    let nnhtml = document.getElementById("nodeNavigator");
    console.log(nn);
    console.log(nnhtml)
    let mimeType = 'text/html';

    let elHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="ie=edge">
  <title>Basic Usage</title>
</head>
<body>

  <h1>Example</h1>
  <div id="nodeNavigator"></div>

  <script src="https://d3js.org/d3.v4.min.js"></script>
  <script type="text/javascript" src="NodeNavigator.js"></script>
  <script type="text/javascript">
    var nn = new NodeNavigator("#nodeNavigator", 600);
  var catColumns = [
    "car-type",
    "gate-name"
  ];
  var seqColumns = [
    "Timestamp"
  ];
  catColumns.forEach((c) => nn.addCategoricalAttrib(c));
  seqColumns.forEach((c) => nn.addSequentialAttrib(c));
  let data = ${JSON.stringify(this.props.data)}
    d3.csv("./data.csv", function (err, data) {
      if (err) throw err;
    data.forEach((d,i) => d.i = i);
    nn.data(data);
  });
  </script>
</body>
</html>`;
    let link = document.getElementById('downloadLink');
    mimeType = mimeType || 'text/plain';
    let filename = 'data.html'
    link.setAttribute('download', filename);
    link.setAttribute('href', 'data:' + mimeType  +  ';charset=utf-8,' + encodeURIComponent(elHtml));
    link.click(); 
  }
  export2 = () => {
    console.log('exporting data')
    let link = document.getElementById('export');
    let mimeType = 'text/csv';
    let filename = 'data.csv';
    link.setAttribute('download', filename);
    let arr = this.props.exportData;
    let csvContent = "data:text/csv;charset=utf-8,";
    arr.forEach(rowArray => {
      let row = rowArray.join(",");
      csvContent += row + "\r\n";
    })
    console.log('end iterating over data')
    let encodedUri = encodeURI(csvContent);
    link.setAttribute('href',encodedUri);
    link.click();
  }
	render() {
    const filter = this.props.exportData.length === 0;
		return (
          <div>
            <div className="change-dataset-button">
              <ButtonGroup>
                <Button onClick={this.onClick}>Change dataset</Button>
                <Button disabled={filter}><CSVLink  filename={"data.csv"} data={this.props.exportData} >Export Data</CSVLink></Button>
                <Button onClick={this.export2}><a href="#" id="export">export2</a></Button>
                <a onClick={this.exportVisualization} href="#" id="downloadLink">Download the inner html</a>
              </ButtonGroup>
            </div>
      		  <div ref={(target) => this.target = target }>
  	        </div>
          </div>
		)
	}
}
Visualization.propTypes = {
  data: PropTypes.array.isRequired,
  updateCallback: PropTypes.func.isRequired
};
export default Visualization;