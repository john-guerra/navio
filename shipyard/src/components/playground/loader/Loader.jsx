import React from 'react';
import { Upload, Icon } from 'antd';
import ModalDefault from './ModalDefault';
import { connect } from 'react-redux';
import { toggleLoading, setData, toggleDataLoaded } from './../../../actions';
import * as vega from 'vega';

const Dragger = Upload.Dragger;
const Loader = ({ toggleLoading, setData, toggleDataLoaded }) => {
  const beforeUpload = (e) => {
    toggleLoading();
    handleFile(e);
  };
  const handleFile = (file) => {
    const reader = new FileReader();
    if(file == null){
      alert('No file selected.');
      return;
    }
    reader.onload = (lEvent: any) => {
      const format = file.name.split('.').pop();
      let values;
      try {
        if (format === 'txt') {
          throw 404;
        }
        values = vega.read(lEvent.target.result, {type: format});
        setData(values);
        toggleLoading();
        toggleDataLoaded();
      } catch (err) {
        // let ssv = d3.dsvFormat(";");
        // values = ssv.parse(lEvent.target.result);
        // setData(values);
        // toggleLoading();
        // toggleDataLoaded();
      }
    };

    reader.readAsText(file);
  }
  return (
    <div style={{ textAlign: 'center', margin: '1em' }}>
      <Dragger
        style={{ alignItems: 'center', minHeight: '70vh' }}
        accept=".csv,.tsv,.txt"
        beforeUpload={beforeUpload}
        name="file"
      >
        <div className="dragger">
          <p className="ant-upload-drag-icon">
            <Icon type="upload" />
          </p>
          <p className="ant-upload-text">Drag and drop a file to this area or click to upload it!</p>
          <p className="ant-upload-hint">*.csv, *.tsv and *.txt files allowed.</p>
        </div>
      </Dragger>
      <br />
      <p> or </p>
      <br />
      <div>
        <ModalDefault />
      </div>
    </div>
  );
};

const mapStateToProps = state => ({

});

const mapDispatchToPropt = dispatch => ({
  toggleLoading: () => dispatch(toggleLoading()),
  setData: data => dispatch(setData(data)),
  toggleDataLoaded: () => dispatch(toggleDataLoaded()),
})

export default connect(mapStateToProps, mapDispatchToPropt)(Loader);
