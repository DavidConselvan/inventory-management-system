import {
  Anchor,
  Button,
  Center,
  Paper,
  PasswordInput,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';

import { errorMessage } from '../api/client';
import { useAuth } from '../auth/AuthContext';

export function LoginPage() {
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const form = useForm({
    initialValues: { username: '', password: '' },
    validate: {
      username: (v) => (v ? null : 'Required'),
      password: (v) => (v ? null : 'Required'),
    },
  });

  if (user) return <Navigate to="/" replace />;

  const submit = form.onSubmit(async (values) => {
    setLoading(true);
    try {
      await login(values.username, values.password);
      navigate('/');
    } catch (err) {
      notifications.show({
        color: 'red',
        title: 'Login failed',
        message: errorMessage(err, 'Invalid username or password'),
      });
    } finally {
      setLoading(false);
    }
  });

  return (
    <Center mih="100vh" p="md">
      <Paper withBorder shadow="md" p={32} radius="md" w={400} maw="100%">
        <Title order={2} ta="center" mb={4}>
          Welcome{' '}
          <Text span inherit fs="italic">
            back
          </Text>
        </Title>
        <Text c="dimmed" size="sm" ta="center" mb="lg">
          Sign in to your inventory workspace
        </Text>
        <form onSubmit={submit}>
          <Stack>
            <TextInput
              label="Username"
              placeholder="your-username"
              {...form.getInputProps('username')}
            />
            <PasswordInput
              label="Password"
              placeholder="Your password"
              {...form.getInputProps('password')}
            />
            <Button type="submit" loading={loading} fullWidth mt="sm">
              Sign in
            </Button>
          </Stack>
        </form>
        <Text size="sm" ta="center" mt="md">
          No account?{' '}
          <Anchor component={Link} to="/register">
            Create one
          </Anchor>
        </Text>
      </Paper>
    </Center>
  );
}
