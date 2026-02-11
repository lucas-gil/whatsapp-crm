import { useEffect, useState } from 'react';

export function useAuth() {
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const initAuth = async () => {
      try {
        // Verificar se já tem token no localStorage
        const storedToken = localStorage.getItem('authToken');
        
        if (storedToken) {
          setToken(storedToken);
          setLoading(false);
          return;
        }

        // Se não tem token, buscar um token padrão
        const apiBase = process.env.NEXT_PUBLIC_API_URL || '';
        const api = apiBase
          ? apiBase.replace(/\/$/, '')
          : '/api';
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
