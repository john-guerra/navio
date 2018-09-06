import React from 'react';
import { connect } from 'react-redux';
import Loader from './loader/Loader';
import NavioContainer from './navio-container/NavioContainer';
import Sample from './sample-data/Sample';


const Playground = ({ dataLoaded, showSidebar }) => {
  return (
    <div style={{ height: '100%' }}>
      <div>
        { dataLoaded ? <div> <NavioContainer />  </div> : <Loader /> }
      </div>
    </div>
  );
};

const mapStateToProps = state => ({
  dataLoaded: state.ui.dataLoaded,
  showSidebar: state.ui.showSidebar,
});

export default connect(mapStateToProps)(Playground);
