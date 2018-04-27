import React, {Component} from 'react';
import { SortableContainer, SortableElement, arrayMove } from 'react-sortable-hoc';
import { Card, Switch, Select, Tooltip, Row, Col, Icon, Collapse, Button, Input, Form, Checkbox } from 'antd';
import './card.css';
import { connect } from 'react-redux';
import { changeCheckStatus, updateAttribute, changeTypeStatus, toggleSettingsVisible, setAttributes } from './../../../../actions';

const FormItem = Form.Item;
const Option = Select.Option;
const Panel = Collapse.Panel;
const customPanelStyle = {
  background: '#fff',
  borderRadius: 4,
  marginBottom: 0,
  border: 0,
  overflow: 'hidden',
};
const header = (value, index, toggleVisible) => (
    <Row type="flex" align="middle" justify="center">
      <Col span={4}>
        <Button onClick={() => {
            toggleVisible(index, !value["settings"]);
          }}
        >
          {
            !value.settings ? <Icon type="setting" /> : <Icon type="up" />
          }
        </Button>
      </Col>
      <Col span={6}>{value.name}</Col>
      <Col span={7}>
        <Select style={{width: '100%'}} dropdownMatchSelectWidth={false}>
          <Option key="categorical" value="categorical" >categorical</Option>
          <Option key="sequential" value="sequential">ordinal</Option>
        </Select>
      </Col>
      <Col span={6} offset={1}>
        <Tooltip placement="right"  title="Here you can change this dimension visibility">
          <Switch defaultChecked style={{marginLeft: '2em'}} />
        </Tooltip>
      </Col>
    </Row>
)
const SortableItem = SortableElement(({value, number, toggleVisible}) => {
  const componentClasses = ['box'];
  if (!value.settings) { componentClasses.push('hide'); }
  return (
    <div style={{ padding: '1em', backgroundColor: 'white', marginBottom: '0.2em', cursor: 'move'}}>
      { header(value, number, toggleVisible) }
      <div className={componentClasses.join(' ')}> 
        <p style={{paddingTop: '1em'}}>color:</p>
        <p>alias:</p>
      </div>
    </div>
  )
});

const SortableList = SortableContainer(({items, toggleVisible}) => {
  return (
    <ul style={{ marginTop: '2em', width: '90%' }}>
      {items.map((value, index) => (
        <SortableItem  key={`item-${index}`} index={index} number={index} value={value} toggleVisible={toggleVisible}/>
      ))}
    </ul>
  );
});

const SortableComponent = ({ attributes, toggleVisible, reorderAttributes}) => {
  const onSortEnd = ({oldIndex, newIndex}) => {
    let copy = attributes.splice(0);
    let newArr = arrayMove(copy, oldIndex, newIndex);
    console.log(copy, newArr);
    reorderAttributes(newArr)
  }
  return (
    <SortableList
      items={attributes}
      onSortEnd={onSortEnd}
      toggleVisible={toggleVisible}
    />
  );
};

const mapStateToProps = state => ({
  attributes: state.shipyard.attributes,
});

const mapDispatchToProps = dispatch => ({
  changeCheckStatus: (att, status) => { dispatch(changeCheckStatus(att, status)); dispatch(updateAttribute())},
  changeTypeStatus: (att, value) => { dispatch(changeTypeStatus(att, value)); dispatch(updateAttribute())},
  toggleVisible: (index, visible) => { dispatch(toggleSettingsVisible(index, visible))},
  reorderAttributes: atts => {dispatch(setAttributes(atts)); dispatch(updateAttribute())},
});

export default connect(mapStateToProps, mapDispatchToProps)(SortableComponent);