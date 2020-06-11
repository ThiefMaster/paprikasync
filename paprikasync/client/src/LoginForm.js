import {FORM_ERROR} from 'final-form';
import flask from 'flask-urls.macro';
import React from 'react';
import {Field, Form as FinalForm} from 'react-final-form';
import {
  Button,
  Form,
  Grid,
  Header,
  Image,
  Message,
  Segment
} from 'semantic-ui-react';
import pepper from './pepper.svg';
import {useAuth} from './util/auth';
import {fetchJSON} from './util/fetch';
import {SUIInputAdapter} from './util/forms';


export const LoginForm = () => {
  const {login, refreshing} = useAuth();

  const handleSubmit = async data => {
    const [status, resp] = await fetchJSON(flask`api.user_login`(), data);
    if (status === 200) {
      login(resp.email, resp.token);
    } else {
      if (resp.error === 'invalid_password') {
        return {[FORM_ERROR]: 'Invalid password'};
      } else if (resp.error === 'invalid_paprika_login') {
        return {[FORM_ERROR]: `Paprika login failed: ${resp.detail}`};
      }
    }
  };

  return (
    <Grid textAlign="center" style={{height: '100vh'}} verticalAlign="middle">
      <Grid.Column style={{maxWidth: 500}}>
        <Header as="h2" color="teal" textAlign="center">
          <Image src={pepper} size="medium" />
          Use your Paprika credentials to login
        </Header>
        <FinalForm
          onSubmit={handleSubmit}
          subscription={{
            submitting: true,
            submitFailed: true,
            submitError: true,
          }}
        >
          {({handleSubmit, submitting, submitFailed, submitError}) => (
            <Form size="large" onSubmit={handleSubmit} error={submitFailed}>
              <Segment>
                <Field
                  name="email"
                  component={SUIInputAdapter}
                  fluid
                  icon="mail"
                  iconPosition="left"
                  placeholder="E-mail address"
                  type="email"
                  validate={v => (v ? undefined : 'required')}
                  disabled={refreshing}
                />
                <Field
                  name="password"
                  component={SUIInputAdapter}
                  fluid
                  icon="lock"
                  iconPosition="left"
                  placeholder="Password"
                  type="password"
                  validate={v => (v ? undefined : 'required')}
                  disabled={refreshing}
                />
                <Button
                  color="teal"
                  fluid
                  size="large"
                  disabled={submitting || refreshing}
                  loading={submitting || refreshing}
                >
                  Login
                </Button>
                <Message
                  error
                  header="Login failed"
                  content={submitError}
                  style={{textAlign: 'left'}}
                />
              </Segment>
            </Form>
          )}
        </FinalForm>
        <Message info>Your Paprika password will not be stored.</Message>
      </Grid.Column>
    </Grid>
  );
};
