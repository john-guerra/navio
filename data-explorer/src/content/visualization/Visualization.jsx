import React, { Component } from 'react';
import PropTypes from "prop-types";
import NodeNavigator from "./NodeNavigator.js";
// let d3 = require("d3");
const cat = "categorical";
const seq = "sequential";
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
    this.nn = new NodeNavigator(this.target, 600)
      .id(this.props.id)
      .updateCallback(this.props.updateCallback);
      this.props.attributes.forEach((d,i)=>{
        if(d.checked){
        console.log(this.props.data)
        console.log("------------");

          if(d.type === cat){
            console.log('cat',d.name);
            this.nn.addCategoricalAttrib(d.name);
          }else if(d.type === seq){
            console.log('seq',d.name);
            this.nn.addSequentialAttrib(d.name);
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

	render(){
		return(
			<div
	          className="visualization"
	          ref={(target) => this.target = target }>
	        </div>
		)
	}
}
Visualization.propTypes = {
  data: PropTypes.array.isRequired,
  updateCallback: PropTypes.func.isRequired
};
export default Visualization;