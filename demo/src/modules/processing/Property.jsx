import React, { Component } from 'react';
import './attribute.css';
class Property extends Component {
  onClickProperty(){
    console.log('onClickProperty');
    this.props.setID(this.props.name)
  }
  render(){
    return(
      <div>
        <div
          className="property cursor"
          onClick={this.onClickProperty.bind(this)}
        >
          {
            this.props.selected ?
            <i class="fa fa-dot-circle-o" aria-hidden="true"></i>
            :
            <i class="fa fa-circle-thin" aria-hidden="true"></i>
          }
          {' '+this.props.name}

        </div>
      </div>
    )
  }
}

export default Property;
