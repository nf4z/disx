package main

import "sync"

type Sfu struct {
	mu    sync.RWMutex
	peers map[string]*Peer
}

func NewSfu() *Sfu {
	return &Sfu{peers: make(map[string]*Peer)}
}

func (r *Sfu) AddPeer(p *Peer) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.peers[p.id] = p
}

func (r *Sfu) RemovePeer(id string) {
	r.mu.Lock()
	defer r.mu.Unlock()
	delete(r.peers, id)
}

func (r *Sfu) GetPeer(id string) *Peer {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return r.peers[id]
}

// PeerSnapshot releases the registry lock before any peer or network work.
func (r *Sfu) PeerSnapshot() []*Peer {
	r.mu.RLock()
	defer r.mu.RUnlock()
	peers := make([]*Peer, 0, len(r.peers))
	for _, p := range r.peers {
		peers = append(peers, p)
	}
	return peers
}

func (r *Sfu) Subscribers(key string) []*Peer {
	peers := r.PeerSnapshot()
	targets := peers[:0]
	for _, p := range peers {
		p.mu.Lock()
		subscribed := p.subscriptions[key]
		p.mu.Unlock()
		if subscribed {
			targets = append(targets, p)
		}
	}
	return targets
}
