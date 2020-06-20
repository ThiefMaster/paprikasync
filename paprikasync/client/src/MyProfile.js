import flask from 'flask-urls.macro';
import React from 'react';
import {Field, Form as FinalForm} from 'react-final-form';
import {Button, Form, Header} from 'semantic-ui-react';
import {useAuth} from './util/auth';
import {fetchJSON} from './util/fetch';
import {SUIInputAdapter} from './util/forms';

export const MyProfile = () => {
  const {
    user: {name},
    rename,
  } = useAuth(true);

  const handleSubmit = async data => {
    const [status, resp] = await fetchJSON(flask`api.user_me_update`(), data, 'PATCH');
    if (status === 200) {
      rename(resp);
    }
  };

  return (
    <>
      <Header as="h1">My profile</Header>
      <FinalForm
        onSubmit={handleSubmit}
        initialValues={{name}}
        subscription={{
          submitting: true,
          pristine: true,
        }}
      >
        {({handleSubmit, submitting, pristine}) => (
          <Form onSubmit={handleSubmit}>
            <>
              <Field
                label="Your name or nickname"
                name="name"
                component={SUIInputAdapter}
                icon="user"
                iconPosition="left"
                placeholder="Your name"
                type="text"
                width={8}
                validate={v => (v && v.trim() ? undefined : 'required')}
              />
              <Button
                color="teal"
                size="large"
                disabled={submitting || pristine}
                loading={submitting}
              >
                Save
              </Button>
            </>
          </Form>
        )}
      </FinalForm>
    </>
  );
};
