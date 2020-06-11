import React from 'react';
import {Form} from 'semantic-ui-react';

export const SUIInputAdapter = ({input, meta, ...rest}) => (
  <Form.Input
    {...input}
    {...rest}
    error={!!(meta.touched && meta.error)}
    disabled={meta.submitting || rest.disabled}
  />
);
