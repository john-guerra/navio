import React from 'react';
import { Upload, Icon, Divider } from 'antd';
import ModalDefault from './ModalDefault';
import { connect } from 'react-redux';
import { toggleLoading, setData, toggleDataLoaded, setComponentClasses } from './../../../actions';
import * as vega from 'vega';

const Dragger = Upload.Dragger;
const Loader = ({ attributes, toggleLoading, setData, toggleDataLoaded, setComponentClasses }) => {
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
          throw Error();
        }
        values = vega.read(lEvent.target.result, {type: format});
        setData(values);
        console.log('before setComponentClasses')
        setComponentClasses(Object.keys(values[0]));
        console.log('after setComponentClasses')
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
          <h1 style={{ fontSize: '2em' }}>
            Drag and drop or click here to upload your dataset
          </h1>
          <p className="ant-upload-hint">*.csv, *.tsv and *.txt files allowed.</p>
        </div>
      </Dragger>
      <div>
        <Divider>
          <p>or you can click below to explore pre-loaded datasets</p>
        </Divider>
      </div>
      <div>
        <ModalDefault />
      </div>
    </div>
  );
};

const mapStateToProps = state => ({
  attributes: state.shipyard.attributes,
});

const mapDispatchToPropt = dispatch => ({
  toggleLoading: () => dispatch(toggleLoading()),
  setData: data => dispatch(setData(data)),
  toggleDataLoaded: () => dispatch(toggleDataLoaded()),
  setComponentClasses: atts => dispatch(setComponentClasses(atts))
})

export default connect(mapStateToProps, mapDispatchToPropt)(Loader);
