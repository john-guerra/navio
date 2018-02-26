import React, { Component } from 'react';
import Property from './Property.jsx';
import Attribute from './Attribute.jsx';
import Step from './../step/Step.jsx';
import NodeNavigatorComponent from './../visualization/NodeNavigatorComponent.jsx';
class ProcessingAttributes extends Component {
  constructor(props){
    super(props);
    this.renderAttributes = this.renderAttributes.bind(this);
  }
  renderAttributes(){
    return this.props.attributes.map((attribute, i) => {
      return (
        <Attribute
          sty={'added'}
          name={attribute}
          key={i}
          id={i}
          deleteAttribute={this.props.deleteAttribute}
          tag={(<i class="fa fa-minus" aria-hidden="true"></i>)}>
        </Attribute>);
    })
  }
  renderDeleted(){
    return this.props.deleted.map((attribute, i) => {
      return (
        <Attribute
          sty={'deleted'}
          name={attribute}
          key={i}
          id={i}
          deleteAttribute={this.props.addAttribute}
          tag={(<i class="fa fa-plus" aria-hidden="true"></i>)}>
        </Attribute>);
    })
  }
  updateCallback(){
    console.log('updateCallback');
  }
  render(){
    return(
      <div>
        <Step
          step={3}
          name={'Select Attributes'}
          text={'Attributes selected. Click the ones you do not want to display.'}
          component={this.renderAttributes()}
          next={'/visualization'}
          back={'/preprocessing/id'}
          enable={true}
          msg={null}
          response={this.renderDeleted()}
          responseMsg={'Attributes deleted. Click one to display.'}>
        </Step>
      </div>
    )
  }
}

export default ProcessingAttributes;
