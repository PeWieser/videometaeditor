import React from 'react';
import { Modal, Progress, Text, Stack } from '@mantine/core';

interface Props {
  opened: boolean;
  message: string;
  value: number; // 0-100, 0 für unbestimmten Fortschritt
}

const ProgressModal: React.FC<Props> = ({ opened, message, value }) => {
  return (
    <Modal opened={opened} onClose={() => {}} closeOnClickOutside={false} withCloseButton={false} centered size="sm" title="Bitte warten">
      <Stack align="center">
        <Text size="sm">{message}</Text>
        <Progress value={value} animated={value === 0} style={{ width: '100%' }} />
      </Stack>
    </Modal>
  );
};

export default ProgressModal;