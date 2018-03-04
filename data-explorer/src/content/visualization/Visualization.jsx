import React, { Component } from 'react';
import PropTypes from "prop-types";
import NodeNavigator from "./NodeNavigator.js";
import { Table, Input, Button, Icon } from 'antd';
// let d3 = require("d3");
const cat = "categorical";
const seq = "sequential";
let d3 = require("d3");
let d3_chromatic = require("d3-scale-chromatic");
class Visualization extends Component {

 componentWillUpdate(newProps) {
    console.log("NodeNavigatorComponent will update data.length=" + newProps.data.length);
    if (newProps.data.length !== this.props.data.length)
      this.nn.data(newProps.data);
  }
  componentDidUpdate(){
    this.setUpNodeNavigator();
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
	render() {
		return (
          <div>
            <div className="change-dataset-button">
              <Button onClick={this.onClick}>Change dataset</Button>
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