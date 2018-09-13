import React from 'react';
import { connect } from 'react-redux';
import { Button, Modal, Card, Row, Col } from 'antd';
import { showModal, handleOk, setData, toggleLoading, toggleDataLoaded, setComponentClasses } from './../../../actions';
import * as d3 from 'd3';

const ModalDefault = ({ visible, datasets, confirmLoading, showModal, handleOk, handleCancel, setData, toggleLoading, toggleDataLoaded, setComponentClasses }) => {
  // const pathDataset = './../../../../public/datasets/';
  // const pathDataset = 'datasets/'; //for local deployment
  const pathDataset = 'https://raw.githubusercontent.com/john-guerra/Navio/master/shipyard/public/datasets/'

  const handleDataset = (name) => {
    toggleLoading();
    console.log(`${pathDataset}${name}`);
    d3.csv(`${pathDataset}${name}`, (err, data) => {
      if (err) throw err;
      console.log('DATA PREdEFINED DATASETS', data);
      setData(data);
      setComponentClasses(Object.keys(data[0]));
      toggleLoading();
      toggleDataLoaded();
      handleCancel();
    });
  };
  return (
    <div>
      <Button type="primary" ghost onClick={showModal}>Choose one</Button>
      <Modal
        title="Datasets"
        visible={visible}
        onOk={handleOk}
        confirmLoading={confirmLoading}
        onCancel={handleCancel}
        width="90%"
        footer={[
          <Button onClick={handleCancel} key="back">Cancel</Button>,
        ]}
      >
        <Row gutter={32}>
          { datasets.map(d => (
            <Col xs={24} sm={12} md={12} lg={6} xl={6} key={d.id}>
              <Card
                onClick={() => handleDataset(d.name)}
                className="hoverable"
                title={d.title}
                style={{ width: '100%', height: '30vh', overflowY: 'scroll', cursor: 'pointer', marginBottom: 32 }}
              >
                <p>Description: {d.description}</p>
                <p>Records(rows): {d.size}</p>
                <p>Attributes: {d.n_attributes}</p>
              </Card>
            </Col>
          ))}
        </Row>
      </Modal>
    </div>
  );
};

const mapStateToProps = state => ({
  visible: state.ui.visible,
  datasets: state.shipyard.datasets,
  confirmLoading: state.ui.confirmLoading,
});

const mapDispatchToProps = dispatch => ({
  showModal: () => dispatch(showModal()),
  handleOk: name => dispatch(handleOk(name)),
  handleCancel: () => dispatch(showModal()),
  setData: (data) => dispatch(setData(data)),
  toggleLoading: () => dispatch(toggleLoading()),
  toggleDataLoaded: () => dispatch(toggleDataLoaded()),
  setComponentClasses: atts => dispatch(setComponentClasses(atts)),
});

export default connect(mapStateToProps, mapDispatchToProps)(ModalDefault);
