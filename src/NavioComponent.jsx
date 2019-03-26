import React, { Component } from "react";
import PropTypes from "prop-types";

import navio from "../../node_modules/navio/dist/navio.js";
// import navio from "navio";

class NavioComponent extends Component {
  constructor(props) {
    super(props);

    this.prevData = null;
    this.prevOpts = null;
    this.hasAddedAttribs = false;
  }

  setOptions() {
    console.log("set options", this.props.options);
    if (this.props.options === undefined) return;

    this.prevOpts = this.props.options;

    for (let opt in this.props.options) {
      this.nv[opt]= this.props.options[opt];
    }
  }

  updateFromProps() {
    this.setOptions();

    // Have we received data?
    if (this.prevData !== this.props.data ||
      this.prevData.length !== this.props.data.length) {
      console.log("Got new data, updating Navio", this.props.data.length);
      this.nv.data(this.props.data);
      this.prevData = this.props.data;

      if (this.props.onFilter &&
        this.nv.updateCallback() !== this.props.onFilter)
        this.nv.updateCallback(this.props.onFilter);
    }

    if (
      !this.hasAddedAttribs &&
      this.props.data.length &&
      this.props.autodetect
    ) {
      this.nv.addAllAttribs(this.props.attributes);
      this.hasAddedAttribs = true;
    }
  }

  componentDidMount() {
    this.nv = navio(this.holder, this.props.height);

    this.updateFromProps();
  }

  componentDidUpdate() {
    this.updateFromProps();
  }

  render() {
    return <div
      style={{overflowX:"scroll"}}
      ref={me => (this.holder = me)}
    />;
  }
}

NavioComponent.propTypes = {
  data: PropTypes.arrayOf(PropTypes.object).isRequired,
  attributes: PropTypes.arrayOf(PropTypes.string),
  options : PropTypes.object,
  autodetect: PropTypes.bool,
  onFilter: PropTypes.func,
  height : PropTypes.number
};

NavioComponent.defaultProps = {
  autodetect: true,
  data: [],
  height: 600
};

export default NavioComponent;
