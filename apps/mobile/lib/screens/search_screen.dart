import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/search_provider.dart';

class SearchScreen extends StatefulWidget {
  const SearchScreen({super.key});

  @override
  State<SearchScreen> createState() => _SearchScreenState();
}

class _SearchScreenState extends State<SearchScreen> {
  final _categoryCtrl = TextEditingController();
  final _cityCtrl = TextEditingController();
  final _stateCtrl = TextEditingController();
  int _radius = 5000;

  static const _categories = [
    'barbearia', 'dentista', 'restaurante', 'padaria', 'hotel',
    'advogado', 'academia', 'veterinario', 'clinica', 'farmacia',
    'loja', 'construtora', 'imobiliaria', 'mecanica', 'supermercado',
  ];

  @override
  void dispose() {
    _categoryCtrl.dispose();
    _cityCtrl.dispose();
    _stateCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final searchProv = context.watch<SearchProvider>();

    return Scaffold(
      appBar: AppBar(title: const Text('Nova Pesquisa')),
      body: ListView(padding: const EdgeInsets.all(16), children: [
        Autocomplete<String>(
          optionsBuilder: (text) => _categories.where((c) => c.contains(text.text.toLowerCase())),
          fieldViewBuilder: (_, controller, focusNode, onSubmit) => TextFormField(
            controller: controller,
            focusNode: focusNode,
            decoration: const InputDecoration(
              labelText: 'Categoria',
              prefixIcon: Icon(Icons.category),
              hintText: 'Ex: barbearia, restaurante...',
            ),
            onFieldSubmitted: (_) => onSubmit(),
          ),
          onSelected: (v) => _categoryCtrl.text = v,
        ),
        const SizedBox(height: 16),
        TextFormField(
          controller: _cityCtrl,
          decoration: const InputDecoration(
            labelText: 'Cidade',
            prefixIcon: Icon(Icons.location_city),
            hintText: 'Ex: São Paulo',
          ),
        ),
        const SizedBox(height: 16),
        TextFormField(
          controller: _stateCtrl,
          decoration: const InputDecoration(
            labelText: 'Estado (UF)',
            prefixIcon: Icon(Icons.map),
            hintText: 'Ex: SP',
          ),
          maxLength: 2,
        ),
        const SizedBox(height: 16),
        Text('Raio: ${(_radius / 1000).toStringAsFixed(0)} km'),
        Slider(
          value: _radius.toDouble(),
          min: 1000,
          max: 100000,
          divisions: 10,
          label: '${(_radius / 1000).toStringAsFixed(0)} km',
          onChanged: (v) => setState(() => _radius = v.round()),
        ),
        const SizedBox(height: 24),
        SizedBox(
          height: 56,
          child: ElevatedButton(
            onPressed: searchProv.loading
                ? null
                : () {
                    final cat = _categoryCtrl.text.trim();
                    if (cat.isEmpty) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('Selecione uma categoria')),
                      );
                      return;
                    }
                    searchProv.startSearch(
                      category: cat,
                      city: _cityCtrl.text.trim().isEmpty ? null : _cityCtrl.text.trim(),
                      state: _stateCtrl.text.trim().isEmpty ? null : _stateCtrl.text.trim(),
                      country: 'Brasil',
                      radius: _radius,
                    );
                  },
            child: searchProv.loading
                ? const Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2)),
                      SizedBox(width: 12),
                      Text('Pesquisando...'),
                    ],
                  )
                : const Text('Iniciar Pesquisa', style: TextStyle(fontSize: 16)),
          ),
        ),
        if (searchProv.progress != null) ...[
          const SizedBox(height: 24),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text('Progresso', style: TextStyle(fontWeight: FontWeight.bold)),
                      Text('${searchProv.progress!['progress'] ?? 0}%'),
                    ],
                  ),
                  const SizedBox(height: 8),
                  LinearProgressIndicator(value: (searchProv.progress!['progress'] ?? 0) / 100),
                  const SizedBox(height: 8),
                  Text('${searchProv.progress!['totalFound'] ?? 0} empresas encontradas'),
                ],
              ),
            ),
          ),
        ],
        if (searchProv.results.isNotEmpty) ...[
          const SizedBox(height: 24),
          Text('Resultados (${searchProv.results.length})', style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
          const SizedBox(height: 12),
          ...searchProv.results.take(10).map((company) => Card(
            child: ListTile(
              leading: CircleAvatar(
                backgroundColor: _scoreColor(company['enrichedData']?['qualityScore'] ?? 0),
                child: Text('${company['enrichedData']?['qualityScore'] ?? '?'}', style: const TextStyle(color: Colors.white, fontSize: 12)),
              ),
              title: Text(company['name'] ?? 'Sem nome', maxLines: 1, overflow: TextOverflow.ellipsis),
              subtitle: Text(company['category'] ?? ''),
              trailing: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  if (company['hasWhatsapp'] == true)
                    const Icon(Icons.phone, size: 16, color: Colors.green),
                  const SizedBox(width: 4),
                  if (company['hasInstagram'] == true)
                    const Icon(Icons.camera_alt, size: 16, color: Colors.pink),
                ],
              ),
              onTap: () => Navigator.pushNamed(context, '/lead-detail', arguments: company),
            ),
          )),
        ],
      ]),
    );
  }

  Color _scoreColor(dynamic score) {
    final s = (score is int) ? score : 50;
    if (s >= 80) return Colors.green;
    if (s >= 60) return Colors.blue;
    if (s >= 40) return Colors.orange;
    return Colors.red;
  }
}
