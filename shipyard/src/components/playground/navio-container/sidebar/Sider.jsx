import React, {Component} from 'react';
import { SortableContainer, SortableElement, arrayMove } from 'react-sortable-hoc';
import { Select, Row, Col, Collapse, Form } from 'antd';
import { SketchPicker } from 'react-color';
import './card.css';
import { connect } from 'react-redux';
import Attribute from './Attribute';
import { changeCheckStatus, updateAttribute, changeTypeStatus, toggleSettingsVisible, setAttributes } from './../../../../actions';

const customPanelStyle = {
  background: '#fff',
  borderRadius: 4,
  marginBottom: 0,
  border: 0,
  overflow: 'hidden',
};

const SortableItem = SortableElement(({value, number, toggleVisible}) => {
  const componentClasses = ['box'];
  if (!value.settings) { componentClasses.push('hide'); }
  return (
    <div style={{ padding: '0.25em', backgroundColor: 'white', marginBottom: '0.25em', cursor: 'move', borderRadius: '5px'}}>
      <Attribute attribute={value} index={number} />
      <div className={componentClasses.join(' ')}> 
        <Row>
          <Col>
            <div>color:</div>
            <SketchPicker />
          </Col>
          <Col>
            <div>alias</div>
          </Col>
        </Row>
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
    if (oldIndex === newIndex) { return; };
    let copy = attributes.splice(0);
    let newArr = arrayMove(copy, oldIndex, newIndex);
    reorderAttributes(newArr);
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
  changeCheckStatus: (att, status) => {
    dispatch(changeCheckStatus(att, status));
    dispatch(updateAttribute())
  },
  changeTypeStatus: (att, value) => { dispatch(changeTypeStatus(att, value)); dispatch(updateAttribute()); },
  toggleVisible: (index, visible) => { dispatch(toggleSettingsVisible(index, visible)); },
  reorderAttributes: atts => { dispatch(setAttributes(atts)); dispatch(updateAttribute()); },
});

export default connect(mapStateToProps, mapDispatchToProps)(SortableComponent);
