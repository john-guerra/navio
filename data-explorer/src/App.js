import React, { Component } from 'react';
import './App.css';
import 'antd/dist/antd.css'; 
import { Icon } from 'antd';
import Menu from './menu/Menu.jsx';
import Content from './content/Content.jsx';

class App extends Component {
  constructor(props){
    super(props);
    this.state = {
      data:[],
      loaded: false,
      showModal: false,
      attributes: [],
      ids: [],
      id: "",
      datasets:["moma","senate","other"],
      loading:false,
    }
  }
  /*
    Function that iterates over the data in order to get the type of each attribute
    @params data is the dataset and atts is the array with the atributtes names and types
    returns an array with the types of the attributes of the data
    also gets the attributte that is id
  */

  getAttributesType(data,atts,ids){
    let seq = "sequential";
    let cat = "categorical";
    let count = 0;     
    for(let prop in data[1]){
      let attr =data[1][prop];
      if(atts[count].name.includes("id") || atts[count].name.includes("key")){
        atts[count].id = true;
        ids.push(atts[count].name);
      }
      let notNumber = isNaN(attr)
      let isDate = this.isDate(attr);
      if(!notNumber){
        atts[count].type = seq;
      }else if(isDate){
        atts[count].type = seq;
      }else {
         atts[count].type = cat;
      }
      count++;
    }
    if(ids.length === 0){
      this.createId(data,atts);
    }
  }
  createId(data,atts){
    console.log(data,atts);
  }
  isDate(attr){
    var mydate = new Date(attr);
    if(isNaN(mydate.getDate())){
      return false;
    }
    return true;
  }
  setLoading = (loading) => {
    this.setState({loading:loading});
  };
  setData(data){
    console.log('setting data')
    /*Creates an empty array that will contain the metadata of the attributes*/
    let atts = []
    let ids = []
    for (let prop in data[0]){
      let i = {};
      i.name = prop;
      i.checked = true;
      i.type = "";
      i.id = false;
      atts.push(i);
    }
    this.getAttributesType(data,atts,ids);
    console.log(atts,'atts');
    this.setState({
      loaded: true,
      attributes: atts,
      ids: ids,
      data: data,
    })
    console.log('end setting data')
  }
  setID(id){
    console.log('setID');
    this.setState({id:id})
  }
  setFile(file){
    console.log('setFile');
  }
  setAttributes(attrs){
    console.log('setatts');
    this.setState({attributes:attrs})
  }
  changeCheckStatus = (attr, checked) => {
    console.log(attr,checked,this.state);
    let attrs = this.state.attributes;
    attrs.forEach(a=>{
      if(a.name === attr.name){
        a.checked = checked;
      }
    })
    this.setState({attributes:attrs});
  }
  updateCallback(callback){
    console.log('updateCallback',callback);
  }
  toggleModal = () => {
    console.log('toggleModal')
    this.setState({
      showModal: !this.state.showModal,
    })
  }
  
  getModal(){
    return (
      <div id="openModal" className="modalDialog">
        <div>
          <a href="#close" title="Close" className="close">X</a>
          <h2>Data Explorer</h2>
          <p>NodeNavigator is a d3.js visualization widget to help summarizing, browsing and navigating large data sets.</p>
          {/*<iframe title="demo" width="100%" height="315" src="https://www.youtube.com/embed/Co074RJXzdk" frameBorder="0" allow="encrypted-media" allowFullScreen></iframe>*/}
        </div>
      </div>
    );
  }
  render() {
    return (
        <div>
        {
                  !this.state.showModal?
                  this.getModal()
                  : ''
        }
           <div className="container">
                <div className="header">
                    <div> <Icon type="compass" /> </div>
                    <div>Data Navigator</div>
                    
                    <div className="info"> <a href="#openModal">  <i className="fas fa-info-circle" ></i> </a></div>
                </div>

                <Menu
                  changeCheckStatus={this.changeCheckStatus}
                  loaded={this.state.loaded}
                  attributes={this.state.attributes}
                  ids={this.state.ids}
                  setId={this.setID.bind(this)}
                  setAttributes={this.setAttributes.bind(this)}

                />
                
                <Content 
                  setLoading={this.setLoading}
                  loading={this.state.loading}
                  datasets={this.state.datasets}
                  setData={this.setData.bind(this)} 
                  loaded={this.state.loaded} 
                  data={this.state.data} 
                  updateCallback={this.updateCallback.bind(this)}
                  attributes={this.state.attributes}
                  ids={this.state.ids}
                  id={this.state.ids[0]}
                />
                
                <div className="footer">

                 <a href="https://github.com/jgmurillo10/thesis" target="_blank" rel="noopener noreferrer"> Github Project MIT License <i className="fab fa-github"></i> </a> 
                </div>
            </div>
        </div>
    );
  }
}

export default App;