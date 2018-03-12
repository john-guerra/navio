import React, { Component } from 'react';
import './App.css';
import 'antd/dist/antd.css'; 
import { Icon } from 'antd';
import Menu from './menu/Menu.jsx';
import Content from './content/Content.jsx';
import * as d3 from "d3";

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
      datasets:[{"name":"all_followers_id.csv"},{"name":"Artworks_less_columns.csv"},{"name":"Lekagul Sensor Data.csv"}],
      loading:false,
      exportData:[],
      closed:false,
    }
  }
  /*
    Function that iterates over the data in order to get the type of each attribute
    @params data is the dataset and atts is the array with the atributtes names and types
    returns an array with the types of the attributes of the data
    also gets the attributte that is id
  */
  componentWillMount(){
    let datasets = this.state.datasets;
    datasets.forEach(d=>{
      d3.csv(`datasets/${d.name}`, function(err,data) {
        if(err) return err;
        console.log(d.name)
        console.log(data)
        d.size = data.length;
        d.data = data;
        d.attributes = []
        for (let prop in data[0]){
          d.attributes.push(prop);
        };
        d.n_attributes = d.attributes.length;
      })
    })
    this.setState({datasets});
  }
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
        atts[count].data = "number";
      }else if(isDate){
        atts[count].type = seq;
        atts[count].data = "date";
      }else {
         atts[count].type = cat;
         atts[count].data = "string";
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
  setData = (data) => {
    console.log('setting data')
    this.setState({originalData:data});
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
    console.log(atts,'atts', ids,'ids');
    data.forEach((row) => {
      atts.forEach(att=> {
        if(att.data === "date"){
          let mydate = new Date(row[att.name]);
          if(isNaN(mydate.getDate())){
            row[att.name] = null;
          }else {
            row[att.name] = mydate
          }
          
        }
        else if(att.data=== "number"){
          let mynumber = +row[att.name];
          if(isNaN(mynumber)){
            row[att.name] = null;
          }else{
            row[att.name] = mynumber;
          }
        }
      })
    })
    console.log(data,'dataParsed');
    this.setState({
      loaded: true,
      attributes: atts,
      ids: ids,
      data: data,
      exportData:data,
      id: ids[0],
    })
    console.log('end setting data')
  }
  setId = (id) => {
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
  changeTypeStatus = (attr,type) => {
    console.log(attr,type,'changeTypeStatus');
    let attrs = this.state.attributes;
    attrs.forEach(a=> {
      if(a.name === attr.name){
        a.type = type;
      }
    })
    this.setState({attributes:attrs});
  }
  onChangeAtt = (attChange) => {
    this.setState({attChange});
  }
  changeCheckStatus = (attr, checked) => {

    console.log(attr,checked,this.state);
    let attrs = this.state.attributes;
    attrs.forEach(a=>{
      if(a.name === attr.name){
        a.checked = checked;
      }
    })
    this.setState({attributes:attrs, attChange:true});
  }
  updateCallback = (callback) => {
    console.log('updateCallback',callback);
    this.setExportData(callback);
  }
  setExportData = (exportData) => {
    this.setState({exportData})
  }
  toggleModal = () => {
    console.log('toggleModal')
    this.setState({
      showModal: !this.state.showModal,
    })
  }
  setLoaded = () => {
    this.setState({
      loaded:false,
      loading:false,
    });
  }
  setClosed = (closed) => {
    this.setState({closed})
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
                    <div className="logo"> <Icon type="compass" /> </div>
                    <div> Data Navigator</div>
                    
                    <div className="info"> <a href="#openModal">  <i className="fas fa-info-circle" ></i> </a></div>
                </div>

                <Menu
                  setClosed={this.setClosed}
                  changeCheckStatus={this.changeCheckStatus}
                  changeTypeStatus={this.changeTypeStatus}
                  loaded={this.state.loaded}
                  attributes={this.state.attributes}
                  ids={this.state.ids}
                  id={this.state.id}
                  setId={this.setId}
                  setAttributes={this.setAttributes.bind(this)}

                />
                
                <Content 
                  closed={this.state.closed}
                  onChangeAtt={this.onChangeAtt}
                  attChange={this.state.attChange}
                  setLoaded={this.setLoaded}
                  setLoading={this.setLoading}
                  loading={this.state.loading}
                  datasets={this.state.datasets}
                  setData={this.setData} 
                  loaded={this.state.loaded} 
                  data={this.state.data} 
                  updateCallback={this.updateCallback}
                  exportData={this.state.exportData}
                  attributes={this.state.attributes}
                  ids={this.state.ids}
                  id={this.state.id}
                />
                
                <div className="footer">

                 <a href="https://github.com/john-guerra/nodenavigator" target="_blank" rel="noopener noreferrer"> Github Project MIT License <i className="fab fa-github"></i> </a> 
                </div>
            </div>
        </div>
    );
  }
}

export default App;