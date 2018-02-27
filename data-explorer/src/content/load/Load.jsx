import React, { Component } from 'react';
import * as vega from 'vega';
import './load.css';

class Load extends Component {
  constructor(props){
      super(props);
      this.state = {
        fileName: 'Upload a dataset',
      }
      this.getFileSize = this.getFileSize.bind(this);
    }
  onChange(e){
    let fileName = e.target.value.split( '\\' ).pop()
    this.setState({
      fileName: fileName
    })
    if (fileName === "" ){
      this.setState({
        fileName: 'Upload a dataset'
      })
    } 

    this.handleFile(e.target.files[0]);
  }
  getFileSize(file){
    let fSExt = ['Bytes', 'KB', 'MB', 'GB'];
    let fSize = file.size;
    let i=0;
    while(fSize>900){
      fSize/=1024;
      i++;
    }
    let finalSize = Math.round(fSize*100)/100 +' '+fSExt[i];
    return finalSize
  }
  handleFile(file){
    const reader = new FileReader();
     if(file == null){
      alert('No file selected.');
      return;
    }
    // let fileSize = this.getFileSize(file);

    reader.onload = (lEvent: any) => {
      // const name = file.name.replace(/\.\w+$/, '');
      const format = file.name.split('.').pop();

      let values;
      try {
        values = vega.read(lEvent.target.result, {type: format});
        // this.props.setData(values);
        this.props.setData(values);
      } catch (err) {
        window.alert(err.message);
      }
    };

    reader.readAsText(file);
  }
  
  
  render() {

    return (
      <div>
        <div className="box">

          <input type="file" name="file-5[]" id="file-5" className="inputfile inputfile-4" data-multiple-caption="{count} files selected" onChange={this.onChange.bind(this)} />
          <label htmlFor="file-5"><figure><svg xmlns="http://www.w3.org/2000/svg" width="20" height="17" viewBox="0 0 20 17"><path d="M10 0l-5.2 4.9h3.3v5.1h3.8v-5.1h3.3l-5.2-4.9zm9.3 11.5l-3.2-2.1h-2l3.4 2.6h-3.5c-.1 0-.2.1-.2.1l-.8 2.3h-6l-.8-2.2c-.1-.1-.1-.2-.2-.2h-3.6l3.4-2.6h-2l-3.2 2.1c-.4.3-.7 1-.6 1.5l.6 3.1c.1.5.7.9 1.2.9h16.3c.6 0 1.1-.4 1.3-.9l.6-3.1c.1-.5-.2-1.2-.7-1.5z"/></svg></figure> <span>{this.state.fileName}</span></label>
        </div>

      </div>
    );
  }
}

export default Load;
