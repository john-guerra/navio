import React from 'react';
import { connect } from 'react-redux';
import { SortableElement } from 'react-sortable-hoc';
import { Button, Input, Divider, Icon } from 'antd';
import { ChromePicker } from 'react-color';
import Attribute from './Attribute';
import ColorPicker from './ColorPicker';
import { toggleColorVisible, setAttributeColor, setAlias } from './../../../../actions';
import './sortableItem.css';

const ButtonGroup = Button.Group;
const onChangeInput = (event, f, attribute) => {
  console.log('onChangeInput')
  console.log(event, f, attribute);
}
const SortableItem = SortableElement(({attribute, number, componentClasses, setColor, toggleColorVisible}) => {
  return (
    <div className="sortableItem" style={{ padding: '0.25em', backgroundColor: 'white', marginBottom: '0em', cursor: 'move', borderRadius: '2px'}}>
      <Attribute attribute={attribute} index={number} />
      <div className={componentClasses.join(' ')}>
        <div className="settings">
          <hr />
          <div className="color">
            <div>
              <div>
                color
              </div>
            </div>
            <div>
              <ColorPicker type={attribute.type} name={attribute.name} />
            </div>
          </div>
          <hr />
          <div className="alias">
            <div>
              alias
            </div>
            <div>
               <Input
                size="small"
                addonAfter={[<Icon key={attribute.name} style={{ color: 'blue' }} type="check" />, <Divider key={attribute.name +'1'} type="vertical" />, <Icon key={attribute.name+'2'} style={{ color: 'red' }} type="delete"/>]}
                defaultValue={attribute.alias}
                onChange={onChangeInput}
                onPressEnter={onChangeInput}
              />
            </div>
          </div>
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

// const mapDispatchToProps = (dispatch, param) => {
//   console.log('dispatch', dispatch, 'param', param);
// };

const mapDispatchToProps = dispatch => ({
  setColor: (color, event, index) => dispatch(setAttributeColor(color, event, index)),
  toggleColorVisible: (index) => dispatch(toggleColorVisible(index)),
  setAlias: (event, attribute) => dispatch(setAlias(event, attribute)),
});

export default connect(mapStateToProps, mapDispatchToProps)(SortableItem);
