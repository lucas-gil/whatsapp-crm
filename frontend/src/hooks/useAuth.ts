import { useEffect, useState } from 'react';

export function useAuth() {
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const initAuth = async () => {
      try {
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

        // Verificar se já tem token no localStorage
        const storedToken = localStorage.getItem('authToken');
        
        if (storedToken) {
          const meResponse = await fetch(`${api}/auth/me`, {
            headers: {
              Authorization: `Bearer ${storedToken}`,
            },
          });

          if (meResponse.ok) {
            setToken(storedToken);
            setLoading(false);
            return;
          }

          localStorage.removeItem('authToken');
        }

        // Se não tem token, buscar um token padrão
        const response = await fetch(`${api}/auth/default-token`);
        
        if (!response.ok) {
          throw new Error('Falha ao obter token padrão');
        }

        const data = await response.json();
        const newToken = data.accessToken;

        // Armazenar no localStorage
        localStorage.setItem('authToken', newToken);
        setToken(newToken);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro desconhecido');
        console.error('Erro ao inicializar autenticação:', err);
      } finally {
        setLoading(false);
      }
    };

    initAuth();
  }, []);

  return { token, loading, error };
}
