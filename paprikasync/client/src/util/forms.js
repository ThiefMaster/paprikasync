import React from 'react';
import {Form} from 'semantic-ui-react';

export const SILENT_INVALID = '__invalid__';

export const SUIInputAdapter = ({verboseError, input, meta, ...rest}) => {
  let errorMessage = null;
  if (meta.touched && meta.error && meta.dirty) {
    errorMessage = meta.error;
  } else if (meta.submitError && !meta.dirtySinceLastSubmit && !meta.submitting) {
    errorMessage = meta.submitError;
  }

  let error = null;
  if (errorMessage) {
    if (verboseError && errorMessage !== SILENT_INVALID) {
      error = {content: errorMessage, pointing: 'above'};
    } else {
      error = true;
    }
  }

  return (
    <Form.Input {...input} {...rest} error={error} disabled={meta.submitting || rest.disabled} />
  );
};

SUIInputAdapter.defaultProps = {
  verboseError: false,
};
