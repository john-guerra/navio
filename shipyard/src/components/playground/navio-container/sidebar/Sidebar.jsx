import React from 'react';
import { connect } from 'react-redux';
import { Switch, Select, Tooltip, Row, Col } from 'antd';
import { changeCheckStatus, updateAttribute, changeTypeStatus } from './../../../../actions';

const Option = Select.Option;
const Sidebar = ({ attributes, changeCheckStatus, changeTypeStatus }) => {
  return (
    <div id="sidebar">
      { attributes.map(att => (
        <Row key={att.name} style={{ margin: '0.3em' }}>
          <Col span={8}>{att.name}</Col>
          <Col span={8}>
            <Select
              defaultValue={att.type}
              onChange={value => changeTypeStatus(att, value)}
            >
              <Option key="categorical" value="categorical" >categorical</Option>
              <Option key="sequential" value="sequential">ordinal</Option>
            </Select>
          </Col>
          <Col span={8}>
            <Tooltip placement="right" title="Here you can change this dimension visibility">
              <Switch defaultChecked onChange={checked => changeCheckStatus(att, checked)} />
            </Tooltip>
          </Col>
        </Row>
      ))}
    </div>
  );
};

const mapStateToProps = state => ({
  attributes: state.shipyard.attributes,
});

const mapDispatchToProps = dispatch => ({
  changeCheckStatus: (att, status) => { dispatch(changeCheckStatus(att, status)); dispatch(updateAttribute())},
  changeTypeStatus: (att, value) => { dispatch(changeTypeStatus(att, value)); dispatch(updateAttribute())},
});

export default connect(mapStateToProps, mapDispatchToProps)(Sidebar);
