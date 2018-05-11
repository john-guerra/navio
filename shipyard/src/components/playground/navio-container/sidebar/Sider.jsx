import React from 'react';
import { arrayMove } from 'react-sortable-hoc';
import { ChromePicker } from 'react-color';
import { connect } from 'react-redux';
import SortableList from './SortableList';
import { changeCheckStatus, updateAttribute, changeTypeStatus, toggleSettingsVisible, setAttributes, setAttributeColor, swapComponentClasses } from './../../../../actions';
import './card.css';

const content = setColor => (
  <div>
    <ChromePicker onChangeComplete={(color, event) => setColor(color, event, 0)} />
  </div>
);

const SortableComponent = ({ attributes, toggleVisible, reorderAttributes, setColor }) => {
  const onSortEnd = ({ oldIndex, newIndex }) => {
    if (oldIndex === newIndex) { return; };
    let copy = [...attributes];
    let newArr = arrayMove(copy, oldIndex, newIndex);
    reorderAttributes(newArr, oldIndex, newIndex);
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
  reorderAttributes: (atts, oldIndex, newIndex) => { dispatch(setAttributes(atts)); dispatch(swapComponentClasses(oldIndex, newIndex)); dispatch(updateAttribute()); },
  setColor: (color, event, type) => dispatch(setAttributeColor(color, event, type)),
});

export default connect(mapStateToProps, mapDispatchToProps)(SortableComponent);
