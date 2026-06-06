import {
  AppShell,
  Avatar,
  Box,
  Burger,
  Group,
  Menu,
  NavLink,
  ScrollArea,
  Text,
  Title,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import {
  IconAsterisk,
  IconBox,
  IconChartPie,
  IconLogout,
  IconPackage,
  IconShoppingCart,
  IconTruckDelivery,
} from '@tabler/icons-react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';

import { useAuth } from '../auth/AuthContext';

const NAV = [
  { to: '/', label: 'Dashboard', icon: IconChartPie },
  { to: '/products', label: 'Products', icon: IconPackage },
  { to: '/stock', label: 'Stock', icon: IconBox },
  { to: '/purchase-orders', label: 'Purchase Orders', icon: IconTruckDelivery },
  { to: '/sales-orders', label: 'Sales Orders', icon: IconShoppingCart },
];

export function AppLayout() {
  const [opened, { toggle, close }] = useDisclosure();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <AppShell
      header={{ height: 60 }}
      navbar={{ width: 260, breakpoint: 'sm', collapsed: { mobile: !opened } }}
      padding="md"
    >
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Group gap="xs">
            <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" />
            <IconAsterisk size={22} stroke={2.5} color="var(--brand-forest)" />
            <Title order={3} fw={600}>
              Kaizntree
            </Title>
            <Text size="sm" c="dimmed" visibleFrom="sm">
              Inventory
            </Text>
          </Group>
          <Menu position="bottom-end" withArrow>
            <Menu.Target>
              <Group gap="xs" style={{ cursor: 'pointer' }}>
                <Avatar color="blue" radius="xl" size="sm">
                  {user?.username?.[0]?.toUpperCase()}
                </Avatar>
                <Text size="sm" visibleFrom="sm">
                  {user?.username}
                </Text>
              </Group>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item
                leftSection={<IconLogout size={16} />}
                onClick={handleLogout}
              >
                Log out
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="md">
        <AppShell.Section grow component={ScrollArea}>
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              component={Link}
              to={item.to}
              label={item.label}
              leftSection={<item.icon size={18} />}
              active={location.pathname === item.to}
              onClick={close}
              variant="light"
            />
          ))}
        </AppShell.Section>
        <AppShell.Section>
          <Box className="text-xs text-gray-400">Operations for CPG · v1.0</Box>
        </AppShell.Section>
      </AppShell.Navbar>

      <AppShell.Main>
        <Outlet />
      </AppShell.Main>
    </AppShell>
  );
}
