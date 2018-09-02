import React from 'react';
import { connect } from 'react-redux';
import { Row, Table } from 'antd';

const Sample = ({ exportData, attributes }) => {
  const preview = exportData.slice(0);
  let columns = [];
  attributes.forEach(a => {
    if (a.data !== 'date') {
      let column = {};
      column.title = a.name;
      column.dataIndex = a.name;
      column.key = a.name;
      column.width = 150;
      columns.push(column);
    } 
  });
  preview.forEach(p => { p.key = p.__seqId });
  return (
    <Row>
      <Table bordered pagination={true} dataSource={preview} columns={columns} scroll={{ x: columns.length * 150, y: '70vh' }} />
    </Row>
  );
};

const mapStateToProps = state => ({
  exportData: state.shipyard.exportData,
  attributes: state.shipyard.attributes,
});

export default connect(mapStateToProps)(Sample);
