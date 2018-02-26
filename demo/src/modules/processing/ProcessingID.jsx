import React, { Component } from 'react';
import Property from './Property.jsx';
import Step from './../step/Step.jsx';
class ProcessingID extends Component {
  constructor(props){
    super(props);
    this.renderProperties = this.renderProperties.bind(this);
    this.state = {
      enable: false,
    }
  }
  setID(id){
    this.setState({ enable:true });
    this.props.setID(id);
  }
  componentDidMount(){
    if (this.props.selected){
      this.setState({enable:true});
    }
    else{
      this.setState({enable:false});
    }
  }
  renderProperties(){
    return this.props.properties.map((property, i) => {
      if (this.props.selected && this.props.selected === property){
            return (<Property name={property} key={i} id={i} setID={this.setID.bind(this)} selected={true}></Property>);
      } else{
          return (<Property name={property} key={i} id={i} setID={this.setID.bind(this)} selected={false}></Property>);
      }

    })
  }
  render(){
    return(
      <div>
        <Step
          step={2}
          name={'Select ID'}
          text={'please select the id (just one) of your dataset'}
          component={this.renderProperties()}
          next={'/preprocessing/attributes'}
          back={'/preprocessing/load'}
          enable={this.state.enable}
          msg={'You must select an ID'}
          >
        </Step>
      </div>
    )
  }
}

export default ProcessingID;
