import { Alert, Center, Loader } from '@mantine/core';
import { IconAlertCircle } from '@tabler/icons-react';
import type { ReactNode } from 'react';

import { errorMessage } from '../api/client';

interface QueryBoundaryProps {
  isLoading: boolean;
  isError: boolean;
  error?: unknown;
  children: ReactNode;
}

export function QueryBoundary({ isLoading, isError, error, children }: QueryBoundaryProps) {
  if (isLoading) {
    return (
      <Center p="xl">
        <Loader />
      </Center>
    );
  }
  if (isError) {
    return (
      <Alert color="red" icon={<IconAlertCircle size={16} />} title="Failed to load">
        {errorMessage(error)}
      </Alert>
    );
  }
  return <>{children}</>;
}
