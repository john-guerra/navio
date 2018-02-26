import React, { Component } from 'react';
import './attribute.css';
class Attribute extends Component {
  onClickAttribute(){
    console.log('onClickAttribute',this.props.id);
    this.props.deleteAttribute(this.props.id);
  }
  render(){
    return(
      <div className="cursor" onClick={this.onClickAttribute.bind(this)}>
        <button  className={this.props.sty + " attribute" }>{this.props.name}</button>
        <button  className={this.props.sty + " attribute-button"}> {this.props.tag} </button>
      </div>
    )
  }
}

export default Attribute;
