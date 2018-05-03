import React from 'react';
import { connect } from 'react-redux';
import { SortableElement } from 'react-sortable-hoc';
import { Button, Input } from 'antd';
import { ChromePicker } from 'react-color';
import Attribute from './Attribute';
import { toggleColorVisible, setAttributeColor } from './../../../../actions';

const SortableItem = SortableElement(({attribute, number, componentClasses, setColor, toggleColorVisible}) => {
  return (
    <div style={{ padding: '0.25em', backgroundColor: 'white', marginBottom: '0.25em', cursor: 'move', borderRadius: '5px'}}>
      <Attribute attribute={attribute} index={number} />
      <div className={componentClasses.join(' ')}>
        <div>
          <span style={{ paddingTop: '1em' }}>
            color
          </span>
          <Button shape="circle" style={{ backgroundColor: attribute.hex || '#fff', border: '1px solid grey', margin: '2em' }} />
          <Button onClick={() => toggleColorVisible(number)} shape="circle" style={{ backgroundColor: attribute.hex || '#fff', border: '1px solid grey', margin: '2em' }} />
          { true ?  <ChromePicker onChangeComplete={(color, event) => setColor(color, event, 0)} /> : ''}
        </div>
        <div>
          <span style={{ paddingTop: '1em' }}>
            alias
          </span>
          <Input placeholder="alias" />
        </div>
      </div>
    </div>
  )
});

const mapStateToProps = (state, props) => ({
  attribute: state.shipyard.attributes[props.number],
  componentClasses: state.ui.componentClasses[props.number].classes,
  number: props.number,
});

const mapDispatchToProps = dispatch => ({
  setColor: (color, event, index) => dispatch(setAttributeColor(color, event, index)),
  toggleColorVisible: (index) => dispatch(toggleColorVisible(index)),
});

export default connect(mapStateToProps, mapDispatchToProps)(SortableItem);
