import React, {Component} from "react";
import PropTypes from "prop-types";
import NodeNavigator from "./NodeNavigator.js";
import { Link } from 'react-router-dom';
let d3 = require("d3");
class NodeNavigatorComponent extends Component {
  constructor(props){
    super(props);

  }
  getTypeProperty(prop){

  }
  componentDidMount() {
    console.log("NodeNavigatorComponent did mount");
    this.nn = new NodeNavigator(this.target, 600)
      .id(this.props.id)
      .updateCallback(this.props.updateCallback);
      this.props.attributes.map((d,i)=>{
        console.log(d,i);
        this.nn.addCategoricalAttrib(d);
      })

    if (this.props.data) {
      this.nn.data(this.props.data);
    }
  }
  componentWillUpdate(newProps) {
    console.log("NodeNavigatorComponent will update data.length=" + newProps.data.length);
    if (newProps.data.length !== this.props.data.length)
      this.nn.data(newProps.data);
  }
  getBreadcrumb(){
    let i  = 4;
    let dir = ['/','/preprocessing/load/','/preprocessing/id','/preprocessing/attributes','/visualization'];
    let names = ['home', 'load','id','attributes','visualization']
    return dir.map((path,it) => {
      if (it >= i) {
        return;
      }
      return (<Link className="btn" to={path}>{'/ step '+ it + ': '  +names[it]}</Link>);
    });
  }
  render() {
    console.log("NodeNavigatorComponent render" );
    return (
      <div>
        <div className="breadcrumb">
          {this.getBreadcrumb()}
        </div>
        {/* <Link to={'/preprocessing/attributes'}>Back</Link> */}
        <div
          className="NodeNavigatorComponent"
          ref={(target) => this.target = target }>
        </div>

      </div>
      );
  }
}
NodeNavigatorComponent.propTypes = {
  data: PropTypes.array.isRequired,
  updateCallback: PropTypes.func.isRequired
};
export default NodeNavigatorComponent;
