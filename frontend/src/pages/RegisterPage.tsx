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

export function RegisterPage() {
  const { register, user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const form = useForm({
    initialValues: { username: '', email: '', password: '' },
    validate: {
      username: (v) => (v ? null : 'Required'),
      password: (v) => (v.length >= 8 ? null : 'At least 8 characters'),
    },
  });

  if (user) return <Navigate to="/" replace />;

  const submit = form.onSubmit(async (values) => {
    setLoading(true);
    try {
      await register(values);
      navigate('/');
    } catch (err) {
      notifications.show({
        color: 'red',
        title: 'Registration failed',
        message: errorMessage(err, 'Could not create account'),
      });
    } finally {
      setLoading(false);
    }
  });

  return (
    <Center mih="100vh" p="md">
      <Paper withBorder shadow="md" p={32} radius="md" w={400} maw="100%">
        <Title order={2} ta="center" mb={4}>
          Create your account
        </Title>
        <Text c="dimmed" size="sm" ta="center" mb="lg">
          Start tracking inventory and profit
        </Text>
        <form onSubmit={submit}>
          <Stack>
            <TextInput
              label="Username"
              placeholder="your-username"
              {...form.getInputProps('username')}
            />
            <TextInput
              label="Email"
              placeholder="you@example.com"
              {...form.getInputProps('email')}
            />
            <PasswordInput
              label="Password"
              placeholder="Choose a strong password"
              {...form.getInputProps('password')}
            />
            <Button type="submit" loading={loading} fullWidth mt="sm">
              Create account
            </Button>
          </Stack>
        </form>
        <Text size="sm" ta="center" mt="md">
          Already have an account?{' '}
          <Anchor component={Link} to="/login">
            Sign in
          </Anchor>
        </Text>
      </Paper>
    </Center>
  );
}
