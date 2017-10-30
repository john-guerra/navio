import React, { Component } from 'react';
import * as vega from 'vega';
import { Link } from 'react-router-dom';
import Step from './../step/Step.jsx';
class Load extends Component {
  constructor(props){
    super(props);
    this.state = {
      file: null,
      enable: false,
    };
    this.state.response = {};
    this.handleDataset = this.handleDataset.bind(this);
    this.renderResponse = this.renderResponse.bind(this);
  };
  componentDidMount(){
    if(this.props.file){
      this.setState({enable:true});
    }else{
      this.setState({enable:false});
    }
  }
  handleDataset(event){
    const reader = new FileReader();
    const file =  event.target.files[0];
    if(file == null){
      alert('No file selected.');
    }
    this.props.setFile(file)

    reader.onload = (lEvent: any) => {
      const name = file.name.replace(/\.\w+$/, '');
      const format = file.name.split('.').pop();

      let values;
      try {
        values = vega.read(lEvent.target.result, {type: format});
        this.props.setData(values);
        this.setState({enable:true})
      } catch (err) {
        window.alert(err.message);
      }
    };

    reader.readAsText(file);
  }
  renderResponse(){
    if (this.props.file){

      return (
          <div>
            <p><strong>Name:</strong> {this.props.file.name}</p>
            <p><strong>File type: </strong>{this.props.file.type}</p>
            <p><strong>File size: </strong>{this.props.file.size}</p>
          </div>
    );
  }
    else {
      return null
    }

  }
  render() {
    const comp = (<input accept=".csv,.json" onChange={this.handleDataset} type="file"/>);
    return (
      <div>
        <Step
          step={1}
          name={'Upload dataset'}
          text={'please select *.json or *.csv file'}
          component={comp}
          action={this.handleDataset}
          next={'/preprocessing/id'}
          back={'/'}
          enable={this.state.enable}
          msg={'You must upload a dataset before continue.'}
          response={this.renderResponse()}
          responseMsg={'Dataset selected'}>
        </Step>

      </div>
    );
  }
}

export default Load;
