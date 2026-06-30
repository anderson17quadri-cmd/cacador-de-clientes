import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/leads_provider.dart';

class FavoritesScreen extends StatefulWidget {
  const FavoritesScreen({super.key});

  @override
  State<FavoritesScreen> createState() => _FavoritesScreenState();
}

class _FavoritesScreenState extends State<FavoritesScreen> {
  @override
  void initState() {
    super.initState();
    Future.microtask(() => context.read<LeadsProvider>().loadFavorites());
  }

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<LeadsProvider>();

    return Scaffold(
      appBar: AppBar(title: const Text('Favoritos')),
      body: provider.loading
          ? const Center(child: CircularProgressIndicator())
          : provider.favorites.isEmpty
              ? const Center(child: Text('Nenhum favorito'))
              : ListView.builder(
                  itemCount: provider.favorites.length,
                  padding: const EdgeInsets.all(8),
                  itemBuilder: (_, i) {
                    final fav = provider.favorites[i];
                    return Dismissible(
                      key: Key(fav['id']),
                      background: Container(color: Colors.red, alignment: Alignment.centerRight, padding: const EdgeInsets.only(right: 16), child: const Icon(Icons.delete, color: Colors.white)),
                      onDismissed: (_) => provider.toggleFavorite(fav['id']),
                      child: Card(
                        child: ListTile(
                          title: Text(fav['name'] ?? ''),
                          subtitle: Text(fav['category'] ?? ''),
                          onTap: () => Navigator.pushNamed(context, '/lead-detail', arguments: fav),
                        ),
                      ),
                    );
                  },
                ),
    );
  }
}
