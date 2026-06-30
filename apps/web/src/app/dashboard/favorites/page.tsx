'use client';

import { useState, useEffect } from 'react';
import { Star, Trash2, MapPin } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import api from '@/lib/api';
import toast from 'react-hot-toast';

interface Favorite {
  id: string;
  companyId: string;
  company: {
    name: string;
    category: string;
    city?: string | null;
    state?: string | null;
  };
}

export default function FavoritesPage() {
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchFavorites();
  }, []);

  const fetchFavorites = async () => {
    try {
      const res = await api.get('/favorites');
      const data = res.data.data;
      setFavorites(Array.isArray(data.data) ? data.data : []);
    } catch {
      setFavorites([]);
    } finally {
      setLoading(false);
    }
  };

  const removeFavorite = async (companyId: string) => {
    try {
      await api.delete(`/favorites/${companyId}`);
      setFavorites((prev) => prev.filter((f) => f.companyId !== companyId));
      toast.success('Removido dos favoritos');
    } catch {
      toast.error('Erro ao remover');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Favoritos</h1>
        <p className="text-muted-foreground mt-1">Empresas salvas como favoritas</p>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}><CardContent className="p-4"><Skeleton className="h-20 w-full" /></CardContent></Card>
          ))}
        </div>
      ) : favorites.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Star className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Nenhum favorito</h3>
            <p className="text-muted-foreground">Salve empresas nos favoritos durante a pesquisa</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {favorites.map((fav) => (
            <motion.div key={fav.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <Card className="hover:shadow-md transition-shadow">
                <CardContent className="p-4 flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold">{fav.company?.name}</h3>
                    <p className="text-sm text-muted-foreground">{fav.company?.category}</p>
                    {fav.company?.city && (
                      <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {fav.company.city}{fav.company.state ? `, ${fav.company.state}` : ''}
                      </p>
                    )}
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => removeFavorite(fav.companyId)}>
                    <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
