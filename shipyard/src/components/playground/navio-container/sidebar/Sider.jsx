import React from 'react';
import { arrayMove } from 'react-sortable-hoc';
import { ChromePicker } from 'react-color';
import './card.css';
import { connect } from 'react-redux';
import SortableList from './SortableList';
import { changeCheckStatus, updateAttribute, changeTypeStatus, toggleSettingsVisible, setAttributes, setAttributeColor } from './../../../../actions';

const content = setColor => (
  <div>
    <ChromePicker onChangeComplete={(color, event) => setColor(color, event, 0)} />
  </div>
);

const SortableComponent = ({ attributes, toggleVisible, reorderAttributes, setColor}) => {
  const onSortEnd = ({oldIndex, newIndex}) => {
    if (oldIndex === newIndex) { return; };
    let copy = attributes.splice(0);
    let newArr = arrayMove(copy, oldIndex, newIndex);
    reorderAttributes(newArr);
  }
  return (
    <SortableList
      onSortEnd={onSortEnd}
    />
  );
};

const mapStateToProps = state => ({
  attributes: state.shipyard.attributes,
});

const mapDispatchToProps = dispatch => ({
  changeCheckStatus: (att, status) => {
    dispatch(changeCheckStatus(att, status));
    dispatch(updateAttribute());
  },
  changeTypeStatus: (att, value) => { dispatch(changeTypeStatus(att, value)); dispatch(updateAttribute()); },
  toggleVisible: (index, visible) => { dispatch(toggleSettingsVisible(index, visible)); },
  reorderAttributes: atts => { dispatch(setAttributes(atts)); dispatch(updateAttribute()); },
  setColor: (color, event, type) => dispatch(setAttributeColor(color, event, type)),
});

export default connect(mapStateToProps, mapDispatchToProps)(SortableComponent);
