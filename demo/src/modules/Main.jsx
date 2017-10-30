import React, { Component } from 'react';
import Home from './home/Home.jsx';
import Load from './load/Load.jsx';
import ProcessingID from './processing/ProcessingID.jsx';
import ProcessingAttributes from './processing/ProcessingAttributes.jsx';
import NodeNavigatorComponent from './visualization/NodeNavigatorComponent.jsx';
import './load/load.css';
import './../index.css';
import { Switch, Route } from 'react-router-dom';

// The Main component renders one of the three provided
// Routes (provided that one matches). Both the /roster
// and /schedule routes will match any pathname that starts
// with /roster or /schedule. The / route will only match
// when the pathname is exactly the string "/"
class Main extends Component {
  constructor(props){
    super(props);
    this.state = {
      data: [],
      selected: "",
      properties: [],
      attributes: [],
      deleted: [],
      file: null,
    }
  }
  setData(data){
    let propps = []
    for (let prop in data[0]){
      propps.push(prop);
    }
    let attributes = propps.slice();
    this.setState({
      data: data,
      properties: propps,
      attributes: attributes
   })

  }
  updateCallback(){
    console.log('updateCallback');
  }
  deleteAttribute(i){
    let p = this.state.attributes;
    let d = this.state.deleted;
    let del = p.splice(i,1);
    d.push(del);
    this.setState({
      attributes: p,
      deleted: d
    });
  }
  addAttribute(i){
    let p = this.state.attributes;
    let d = this.state.deleted;
    let add = d.splice(i,1);
    p.push(add)
    this.setState({
      attributes: p,
      deleted: d
    })
  }
  setID(id){
    this.setState({ selected: id });
  }
  setFile(file){
    this.setState({ file: file });
  }
  render(){
    const extraProps = { color: 'red' }
    return (
      <main>
        <Switch>
          <Route exact path='/' component={Home}/>
          <Route path='/preprocessing/load' render={(props) => (
            <Load {...props}
              setData={this.setData.bind(this)}
              setFile={this.setFile.bind(this)}
              file={this.state.file}/>
          )}/>
          <Route path='/preprocessing/id' render={(props) => (
            <ProcessingID {...props}
              data={this.state.data}
              setID={this.setID.bind(this)}
              properties={this.state.properties}
              selected={this.state.selected}/>
          )}/>
        <Route path='/preprocessing/attributes' render={(props) => (
            <ProcessingAttributes {...props}
              data={this.state.data}
              deleteAttribute={this.deleteAttribute.bind(this)}
              addAttribute={this.addAttribute.bind(this)}
              attributes={this.state.attributes}
              deleted={this.state.deleted}/>
          )}/>
        <Route path='/visualization' render={(props) => (
          <NodeNavigatorComponent
            attributes={this.state.attributes}
            data={this.state.data}
            id={this.state.selected}
            updateCallback={this.updateCallback.bind(this)}>
          </NodeNavigatorComponent>
            )}/>

        </Switch>
      </main>
    )
  }
}

export default Main;
