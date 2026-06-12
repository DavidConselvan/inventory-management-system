import {
  Anchor,
  Button,
  Center,
  Group,
  Paper,
  PasswordInput,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { IconAsterisk } from '@tabler/icons-react';
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
      <Paper withBorder shadow="xs" p={36} radius="md" w={400} maw="100%">
        <Group justify="center" gap={8} mb="lg">
          <IconAsterisk size={22} stroke={2.5} color="var(--brand-forest)" />
          <Text fw={600} fz="lg" style={{ letterSpacing: '-0.01em' }}>
            Kaizntree
          </Text>
        </Group>
        <Title order={2} ta="center" mb={4}>
          Welcome <span className="accent">back</span>
        </Title>
        <Text c="dimmed" size="sm" ta="center" mb="xl">
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
