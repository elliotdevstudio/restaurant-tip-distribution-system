'use client';

import { Provider } from 'jotai';

export default function ClientProvider({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <Provider>
      {children}
    </Provider>
  );
}