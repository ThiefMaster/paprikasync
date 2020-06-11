import React from 'react';
import ReactDOM from 'react-dom';
import {App} from './App';
import {AuthProvider} from './util/auth';

import 'semantic-ui-css/semantic.min.css';
import './style.css';

ReactDOM.render(
  <AuthProvider>
    <App />
  </AuthProvider>,
  document.getElementById('root')
);
