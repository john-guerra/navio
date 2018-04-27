import React, {Component} from 'react';
import {render} from 'react-dom';
import { Card, Switch, Select, Tooltip, Row, Col, Icon } from 'antd';
import {
  SortableContainer,
  SortableElement,
  SortableHandle,
  arrayMove,
} from 'react-sortable-hoc';

const Option = Select.Option;
const DragHandle = SortableHandle(() => <Icon type="swap" />); // This can be any component you want

const SortableItem = SortableElement(({value}) => {
  return (
    <Card style={{ width: 300 }}>
      <span><Icon type="setting" /></span>
      <span>{value}</span>
      <span>
        <Select >
          <Option key="categorical" value="categorical" >categorical</Option>
          <Option key="sequential" value="sequential">ordinal</Option>
        </Select>
      </span>
      <span>
        <Tooltip placement="right"  title="Here you can change this dimension visibility">
          <Switch defaultChecked />
        </Tooltip>
      </span>

    </Card>
   
  );
});

const SortableList = SortableContainer(({items}) => {
  return (
    <ul>
      {items.map((value, index) => (
        <SortableItem key={`item-${index}`} index={index} value={value} />
      ))}
    </ul>
  );
});

class SortableComponent extends Component {
  state = {
    items: ['Item 1', 'Item 2', 'Item 3', 'Item 4', 'Item 5', 'Item 6'],
  };
  onSortEnd = ({oldIndex, newIndex}) => {
    const {items} = this.state;

    this.setState({
      // items: arrayMove(items, oldIndex, newIndex),
    });
  };
  render() {
    const {items} = this.state;

    return <SortableList items={items} onSortEnd={this.onSortEnd} transitionDuration={0} />;
  }
}
export default SortableComponent;