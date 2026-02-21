import { useEffect, useState } from 'react';

export function useAuth() {
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const getApi = () => {
    const apiBase = process.env.NEXT_PUBLIC_API_URL || '';
    let api = apiBase ? apiBase.replace(/\/$/, '') : '/api';

    if (typeof window !== 'undefined' && apiBase) {
      try {
        const apiUrl = new URL(apiBase, window.location.origin);
        if (apiUrl.host !== window.location.host || apiUrl.hostname === 'localhost') {
          api = '/api';
        }
      } catch (err) {
        api = '/api';
      }
    }

    return api;
  };

  useEffect(() => {
    const initAuth = async () => {
      try {
        const api = getApi();

        // Verificar se já tem token no localStorage
        const storedToken = localStorage.getItem('authToken');
        if (storedToken) {
          const meResponse = await fetch(`${api}/auth/me`, {
            headers: { Authorization: `Bearer ${storedToken}` },
          });

          if (meResponse.ok) {
            setToken(storedToken);
            return;
          }

          localStorage.removeItem('authToken');
        }

        // Não obter automaticamente token padrão — exigir que usuário faça login
      } catch (err) {
        console.error('Erro ao inicializar autenticação:', err);
      } finally {
        setLoading(false);
      }
    };

    initAuth();
  }, []);

  const login = async (key: string, workspaceSlug = 'default') => {
    setLoading(true);
    setError(null);
    try {
      const api = getApi();
      const res = await fetch(`${api}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, workspaceSlug }),
      });

      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || 'Falha no login');
      }

      const data = await res.json();
      const newToken = data.accessToken;
      localStorage.setItem('authToken', newToken);
      setToken(newToken);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    const api = getApi();
    const storedToken = localStorage.getItem('authToken');
    try {
      if (storedToken) {
        await fetch(`${api}/auth/logout`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${storedToken}` },
        });
      }
    } catch (e) {
      // ignore
    }
    localStorage.removeItem('authToken');
    setToken(null);
  };

  return { token, loading, error, login, logout } as const;
}
