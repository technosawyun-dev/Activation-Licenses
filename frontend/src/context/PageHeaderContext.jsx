import { createContext, useContext, useEffect, useState } from 'react';

const PageHeaderContext = createContext(null);

export function PageHeaderProvider({ children }) {
  const [header, setHeader] = useState({ title: '', actions: null });
  return (
    <PageHeaderContext.Provider value={{ header, setHeader }}>
      {children}
    </PageHeaderContext.Provider>
  );
}

// Pages call this to set the shared top-bar title + action buttons.
export function usePageHeader(title, actions = null) {
  const { setHeader } = useContext(PageHeaderContext);
  useEffect(() => {
    setHeader({ title, actions });
  }, [title, actions, setHeader]);
}

export function useHeaderValue() {
  return useContext(PageHeaderContext).header;
}
