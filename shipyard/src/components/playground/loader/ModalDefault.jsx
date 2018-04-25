import React from 'react';
import { connect } from 'react-redux';
import { Button, Modal, Card, Row, Col, Icon } from 'antd';
import { showModal, handleOk, setData, toggleLoading, toggleDataLoaded } from './../../../actions';
import * as d3 from 'd3';

const ModalDefault = ({ visible, datasets, confirmLoading, showModal, handleOk, handleCancel, setData, toggleLoading, toggleDataLoaded }) => {
  // const pathDataset = './../../../../public/datasets/';
  const pathDataset = 'datasets/';
  const handleDataset = (name) => {
    toggleLoading();
    console.log(`${pathDataset}${name}`);
    d3.csv(`${pathDataset}${name}`, (err, data) => {
      if (err) throw err;
      console.log('data', data);
      setData(data);
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
        <Row>
          { datasets.map(d => (
            <Col span={8} key={d.id}>
              <Card
                onClick={() => handleDataset(d.name)}
                className="hoverable"
                title={d.title}
                style={{ width: 300, height: '30vh', overflowY: 'scroll', cursor: 'pointer' }}
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
});

export default connect(mapStateToProps, mapDispatchToProps)(ModalDefault);
