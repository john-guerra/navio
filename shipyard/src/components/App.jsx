import { Affix, Layout } from 'antd';
import React from 'react';
import { connect } from 'react-redux';
import HeaderComponent from './header/Header';
import FooterComponent from './footer/Footer';
import Playground from './playground/Playground';

const { Header, Content, Footer } = Layout;
const headerStyle = {
  margin: 0, padding: 0, backgroundColor: 'white', boxShadow: '0 10px 8px rgba(0,0,0,0.15), 0 8px 8px rgba(0,0,0,0.12)',
};
const App = loading => (
  <div>
    <Layout>
      <Affix>
        <Header style={headerStyle}>
          <HeaderComponent />
        </Header>
      </Affix>
      <Content>
        { loading ? <Playground /> : 'loading' }
      </Content>
      <Footer>
        <FooterComponent />
      </Footer>
    </Layout>
  </div>
);

const mapStateToProps = state => ({
  loading: state.ui.loading,
});

export default connect(mapStateToProps)(App);

