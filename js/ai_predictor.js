// sainisatta Live - Unified Neural Network (ANN/RNN) Predictor Core
// Pure JavaScript backpropagation-based feedforward and recurrent neural networks

(function() {
  // --- ACTIVATION FUNCTIONS ---
  const Activations = {
    sigmoid: {
      fn: x => 1 / (1 + Math.exp(-Math.max(-20, Math.min(20, x)))),
      df: y => y * (1 - y)
    },
    tanh: {
      fn: x => Math.tanh(x),
      df: y => 1 - y * y
    },
    relu: {
      fn: x => Math.max(0, x),
      df: y => y > 0 ? 1 : 0
    },
    linear: {
      fn: x => x,
      df: y => 1
    }
  };

  // --- FEEDFORWARD NEURAL NETWORK (ANN) ---
  class FeedForwardNN {
    constructor(layerSizes, activation = 'sigmoid', learningRate = 0.05) {
      this.sizes = layerSizes;
      this.learningRate = learningRate;
      this.activation = Activations[activation] || Activations.sigmoid;
      
      // Initialize weights & biases (Xavier / Glorot initialization)
      this.weights = [];
      this.biases = [];
      this.m_w = [];
      this.v_w = [];
      this.m_b = [];
      this.v_b = [];
      this.t = 0;
      
      for (let i = 0; i < layerSizes.length - 1; i++) {
        const inputSize = layerSizes[i];
        const outputSize = layerSizes[i + 1];
        
        // Weights matrix: row = output, col = input
        const wMat = Array(outputSize).fill(0).map(() => 
          Array(inputSize).fill(0).map(() => {
            const limit = Math.sqrt(6 / (inputSize + outputSize));
            return (Math.random() * 2 - 1) * limit;
          })
        );
        this.weights.push(wMat);
        
        // Biases vector
        const bVec = Array(outputSize).fill(0).map(() => 0.0);
        this.biases.push(bVec);

        // Adam moments
        this.m_w.push(Array(outputSize).fill(0).map(() => Array(inputSize).fill(0.0)));
        this.v_w.push(Array(outputSize).fill(0).map(() => Array(inputSize).fill(0.0)));
        this.m_b.push(Array(outputSize).fill(0.0));
        this.v_b.push(Array(outputSize).fill(0.0));
      }
    }

    forward(inputs) {
      let activations = [...inputs];
      const layerOutputs = [activations]; // store activations layer by layer

      for (let i = 0; i < this.weights.length; i++) {
        const nextActivations = [];
        const w = this.weights[i];
        const b = this.biases[i];
        
        for (let j = 0; j < w.length; j++) {
          let sum = b[j];
          for (let k = 0; k < w[j].length; k++) {
            sum += w[j][k] * activations[k];
          }
          nextActivations.push(this.activation.fn(sum));
        }
        activations = nextActivations;
        layerOutputs.push(activations);
      }
      return layerOutputs;
    }

    backprop(inputs, targets) {
      const layerOutputs = this.forward(inputs);
      const outputs = layerOutputs[layerOutputs.length - 1];
      
      // Calculate output layer error delta
      let deltas = [];
      const outputDeltas = Array(outputs.length).fill(0);
      for (let i = 0; i < outputs.length; i++) {
        const err = targets[i] - outputs[i];
        outputDeltas[i] = err * this.activation.df(outputs[i]);
      }
      deltas.unshift(outputDeltas);
      
      // Backpropagate error deltas through hidden layers
      for (let i = this.weights.length - 1; i > 0; i--) {
        const nextDeltas = deltas[0];
        const w = this.weights[i];
        const layerVals = layerOutputs[i];
        const currentDeltas = Array(w[0].length).fill(0);
        
        for (let j = 0; j < w[0].length; j++) {
          let err = 0;
          for (let k = 0; k < w.length; k++) {
            err += w[k][j] * nextDeltas[k];
          }
          currentDeltas[j] = err * this.activation.df(layerVals[j]);
        }
        deltas.unshift(currentDeltas);
      }
      
      // Adam parameters
      this.t++;
      const beta1 = 0.9;
      const beta2 = 0.999;
      const epsilon = 1e-8;
      const biasCorrection1 = 1 - Math.pow(beta1, this.t);
      const biasCorrection2 = 1 - Math.pow(beta2, this.t);
      
      // Update weights and biases using Adam Optimizer
      for (let i = 0; i < this.weights.length; i++) {
        const w = this.weights[i];
        const b = this.biases[i];
        const mw = this.m_w[i];
        const vw = this.v_w[i];
        const mb = this.m_b[i];
        const vb = this.v_b[i];
        
        const layerInputs = layerOutputs[i];
        const layerDeltas = deltas[i];
        
        for (let j = 0; j < w.length; j++) {
          // Bias update
          const g_b = layerDeltas[j];
          mb[j] = beta1 * mb[j] + (1 - beta1) * g_b;
          vb[j] = beta2 * vb[j] + (1 - beta2) * g_b * g_b;
          const mbHat = mb[j] / biasCorrection1;
          const vbHat = vb[j] / biasCorrection2;
          b[j] += this.learningRate * mbHat / (Math.sqrt(vbHat) + epsilon);
          
          for (let k = 0; k < w[j].length; k++) {
            // Weight update
            const g_w = layerDeltas[j] * layerInputs[k];
            mw[j][k] = beta1 * mw[j][k] + (1 - beta1) * g_w;
            vw[j][k] = beta2 * vw[j][k] + (1 - beta2) * g_w * g_w;
            const mwHat = mw[j][k] / biasCorrection1;
            const vwHat = vw[j][k] / biasCorrection2;
            w[j][k] += this.learningRate * mwHat / (Math.sqrt(vwHat) + epsilon);
          }
        }
      }
      
      // Return Mean Squared Error
      let mse = 0;
      for (let i = 0; i < outputs.length; i++) {
        mse += Math.pow(targets[i] - outputs[i], 2);
      }
      return mse / outputs.length;
    }

    trainOnline(inputs, targets) {
      return this.backprop(inputs, targets);
    }

    trainBatch(dataset, epochs = 100) {
      let totalMse = 0;
      for (let ep = 0; ep < epochs; ep++) {
        let epMse = 0;
        for (let i = 0; i < dataset.length; i++) {
          epMse += this.backprop(dataset[i].inputs, dataset[i].targets);
        }
        totalMse = epMse / dataset.length;
      }
      return totalMse;
    }

    save() {
      return JSON.stringify({
        weights: this.weights,
        biases: this.biases
      });
    }

    load(jsonStr) {
      try {
        const data = JSON.parse(jsonStr);
        if (data.weights && data.biases) {
          if (data.weights.length !== this.sizes.length - 1) return false;
          if (data.biases.length !== this.sizes.length - 1) return false;
          for (let i = 0; i < this.weights.length; i++) {
            const outSize = this.sizes[i + 1];
            const inSize = this.sizes[i];
            if (!data.weights[i] || data.weights[i].length !== outSize) return false;
            for (let j = 0; j < outSize; j++) {
              if (!data.weights[i][j] || data.weights[i][j].length !== inSize) return false;
            }
            if (!data.biases[i] || data.biases[i].length !== outSize) return false;
          }
          this.weights = data.weights;
          this.biases = data.biases;
          // Re-initialize moments
          this.t = 0;
          this.m_w = [];
          this.v_w = [];
          this.m_b = [];
          this.v_b = [];
          for (let i = 0; i < this.weights.length; i++) {
            const outSize = this.sizes[i + 1];
            const inSize = this.sizes[i];
            this.m_w.push(Array(outSize).fill(0).map(() => Array(inSize).fill(0.0)));
            this.v_w.push(Array(outSize).fill(0).map(() => Array(inSize).fill(0.0)));
            this.m_b.push(Array(outSize).fill(0.0));
            this.v_b.push(Array(outSize).fill(0.0));
          }
          return true;
        }
      } catch (e) {
        console.error("FFNN load error:", e);
      }
      return false;
    }
  }

  // --- RECURRENT NEURAL NETWORK (RNN) ---
  // Simple Elman Recurrent Neural Network
  class SimpleRNN {
    constructor(inputSize, hiddenSize, outputSize, learningRate = 0.02) {
      this.inputSize = inputSize;
      this.hiddenSize = hiddenSize;
      this.outputSize = outputSize;
      this.learningRate = learningRate;
      
      this.activationHidden = Activations.tanh;
      this.activationOutput = Activations.sigmoid;
      
      // Hidden State initialized to 0
      this.hiddenState = Array(hiddenSize).fill(0.0);
      
      // Initialize weights & biases
      // Wxh (input to hidden)
      this.Wxh = Array(hiddenSize).fill(0).map(() => 
        Array(inputSize).fill(0).map(() => (Math.random() * 2 - 1) * Math.sqrt(2 / (inputSize + hiddenSize)))
      );
      
      // Whh (hidden to hidden)
      this.Whh = Array(hiddenSize).fill(0).map(() => 
        Array(hiddenSize).fill(0).map(() => (Math.random() * 2 - 1) * Math.sqrt(2 / (hiddenSize + hiddenSize)))
      );
      
      // Why (hidden to output)
      this.Why = Array(outputSize).fill(0).map(() => 
        Array(hiddenSize).fill(0).map(() => (Math.random() * 2 - 1) * Math.sqrt(2 / (hiddenSize + outputSize)))
      );
      
      // Biases
      this.bh = Array(hiddenSize).fill(0.0);
      this.by = Array(outputSize).fill(0.0);

      // Adam moments
      this.t = 0;
      this.m_Wxh = Array(hiddenSize).fill(0).map(() => Array(inputSize).fill(0.0));
      this.v_Wxh = Array(hiddenSize).fill(0).map(() => Array(inputSize).fill(0.0));
      
      this.m_Whh = Array(hiddenSize).fill(0).map(() => Array(hiddenSize).fill(0.0));
      this.v_Whh = Array(hiddenSize).fill(0).map(() => Array(hiddenSize).fill(0.0));
      
      this.m_Why = Array(outputSize).fill(0).map(() => Array(hiddenSize).fill(0.0));
      this.v_Why = Array(outputSize).fill(0).map(() => Array(hiddenSize).fill(0.0));
      
      this.m_bh = Array(hiddenSize).fill(0.0);
      this.v_bh = Array(hiddenSize).fill(0.0);
      
      this.m_by = Array(outputSize).fill(0.0);
      this.v_by = Array(outputSize).fill(0.0);
    }

    resetState() {
      this.hiddenState.fill(0.0);
    }

    forward(inputs) {
      const nextHidden = [];
      
      // ht = tanh(Wxh * xt + Whh * ht-1 + bh)
      for (let i = 0; i < this.hiddenSize; i++) {
        let sum = this.bh[i];
        for (let j = 0; j < this.inputSize; j++) {
          sum += this.Wxh[i][j] * inputs[j];
        }
        for (let j = 0; j < this.hiddenSize; j++) {
          sum += this.Whh[i][j] * this.hiddenState[j];
        }
        nextHidden.push(this.activationHidden.fn(sum));
      }
      this.hiddenState = nextHidden;
      
      // yt = sigmoid(Why * ht + by)
      const outputs = [];
      for (let i = 0; i < this.outputSize; i++) {
        let sum = this.by[i];
        for (let j = 0; j < this.hiddenSize; j++) {
          sum += this.Why[i][j] * this.hiddenState[j];
        }
        outputs.push(this.activationOutput.fn(sum));
      }
      
      return outputs;
    }

    // Backpropagation Through Time (BPTT) for a single sequence
    trainSequence(sequence, targets) {
      const timeSteps = sequence.length;
      const hStates = [Array(this.hiddenSize).fill(0.0)]; // h[-1]
      const outputs = [];
      const inputs = [];
      
      // 1. Forward pass over the sequence
      for (let t = 0; t < timeSteps; t++) {
        const xt = sequence[t];
        inputs.push(xt);
        
        // Recalculate cell math storing values at each timestep
        const prevH = hStates[t];
        const nextH = [];
        
        for (let i = 0; i < this.hiddenSize; i++) {
          let sum = this.bh[i];
          for (let j = 0; j < this.inputSize; j++) {
            sum += this.Wxh[i][j] * xt[j];
          }
          for (let j = 0; j < this.hiddenSize; j++) {
            sum += this.Whh[i][j] * prevH[j];
          }
          nextH.push(this.activationHidden.fn(sum));
        }
        hStates.push(nextH);
        
        const yt = [];
        for (let i = 0; i < this.outputSize; i++) {
          let sum = this.by[i];
          for (let j = 0; j < this.hiddenSize; j++) {
            sum += this.Why[i][j] * nextH[j];
          }
          yt.push(this.activationOutput.fn(sum));
        }
        outputs.push(yt);
      }
      
      // 2. Backward Pass (BPTT)
      const dWxh = Array(this.hiddenSize).fill(0).map(() => Array(this.inputSize).fill(0.0));
      const dWhh = Array(this.hiddenSize).fill(0).map(() => Array(this.hiddenSize).fill(0.0));
      const dWhy = Array(this.outputSize).fill(0).map(() => Array(this.hiddenSize).fill(0.0));
      const dbh = Array(this.hiddenSize).fill(0.0);
      const dby = Array(this.outputSize).fill(0.0);
      
      let nextHGrad = Array(this.hiddenSize).fill(0.0);
      let mse = 0.0;
      
      for (let t = timeSteps - 1; t >= 0; t--) {
        const yt = outputs[t];
        const target = targets[t];
        const ht = hStates[t + 1];
        const prevH = hStates[t];
        const xt = inputs[t];
        
        // Output gradient dLoss/dy_t
        const dyGrad = [];
        for (let i = 0; i < this.outputSize; i++) {
          const diff = target[i] - yt[i];
          mse += Math.pow(diff, 2);
          dyGrad.push(diff * this.activationOutput.df(yt[i]));
        }
        
        // Why gradients
        for (let i = 0; i < this.outputSize; i++) {
          dby[i] += dyGrad[i];
          for (let j = 0; j < this.hiddenSize; j++) {
            dWhy[i][j] += dyGrad[i] * ht[j];
          }
        }
        
        // Hidden state gradient dLoss/dh_t
        const dhGrad = Array(this.hiddenSize).fill(0.0);
        for (let i = 0; i < this.hiddenSize; i++) {
          let sum = nextHGrad[i];
          for (let j = 0; j < this.outputSize; j++) {
            sum += this.Why[j][i] * dyGrad[j];
          }
          // multiply by tanh derivative
          dhGrad[i] = sum * this.activationHidden.df(ht[i]);
        }
        
        // Wxh, Whh, bh gradients
        for (let i = 0; i < this.hiddenSize; i++) {
          dbh[i] += dhGrad[i];
          for (let j = 0; j < this.inputSize; j++) {
            dWxh[i][j] += dhGrad[i] * xt[j];
          }
          for (let j = 0; j < this.hiddenSize; j++) {
            dWhh[i][j] += dhGrad[i] * prevH[j];
          }
        }
        
        // Pass gradient back to t-1
        nextHGrad = Array(this.hiddenSize).fill(0.0);
        for (let i = 0; i < this.hiddenSize; i++) {
          let sum = 0;
          for (let j = 0; j < this.hiddenSize; j++) {
            sum += this.Whh[j][i] * dhGrad[j];
          }
          nextHGrad[i] = sum;
        }
      }
      
      // Update RNN Weights using Adam Optimizer
      this.t++;
      const beta1 = 0.9;
      const beta2 = 0.999;
      const epsilon = 1e-8;
      const biasCorrection1 = 1 - Math.pow(beta1, this.t);
      const biasCorrection2 = 1 - Math.pow(beta2, this.t);

      for (let i = 0; i < this.hiddenSize; i++) {
        // bh
        const g_bh = dbh[i] / timeSteps;
        this.m_bh[i] = beta1 * this.m_bh[i] + (1 - beta1) * g_bh;
        this.v_bh[i] = beta2 * this.v_bh[i] + (1 - beta2) * g_bh * g_bh;
        const mbhHat = this.m_bh[i] / biasCorrection1;
        const vbhHat = this.v_bh[i] / biasCorrection2;
        this.bh[i] += this.learningRate * mbhHat / (Math.sqrt(vbhHat) + epsilon);

        // Wxh
        for (let j = 0; j < this.inputSize; j++) {
          const g_Wxh = dWxh[i][j] / timeSteps;
          this.m_Wxh[i][j] = beta1 * this.m_Wxh[i][j] + (1 - beta1) * g_Wxh;
          this.v_Wxh[i][j] = beta2 * this.v_Wxh[i][j] + (1 - beta2) * g_Wxh * g_Wxh;
          const mWxhHat = this.m_Wxh[i][j] / biasCorrection1;
          const vWxhHat = this.v_Wxh[i][j] / biasCorrection2;
          this.Wxh[i][j] += this.learningRate * mWxhHat / (Math.sqrt(vWxhHat) + epsilon);
        }

        // Whh
        for (let j = 0; j < this.hiddenSize; j++) {
          const g_Whh = dWhh[i][j] / timeSteps;
          this.m_Whh[i][j] = beta1 * this.m_Whh[i][j] + (1 - beta1) * g_Whh;
          this.v_Whh[i][j] = beta2 * this.v_Whh[i][j] + (1 - beta2) * g_Whh * g_Whh;
          const mWhhHat = this.m_Whh[i][j] / biasCorrection1;
          const vWhhHat = this.v_Whh[i][j] / biasCorrection2;
          this.Whh[i][j] += this.learningRate * mWhhHat / (Math.sqrt(vWhhHat) + epsilon);
        }
      }

      for (let i = 0; i < this.outputSize; i++) {
        // by
        const g_by = dby[i] / timeSteps;
        this.m_by[i] = beta1 * this.m_by[i] + (1 - beta1) * g_by;
        this.v_by[i] = beta2 * this.v_by[i] + (1 - beta2) * g_by * g_by;
        const mbyHat = this.m_by[i] / biasCorrection1;
        const vbyHat = this.v_by[i] / biasCorrection2;
        this.by[i] += this.learningRate * mbyHat / (Math.sqrt(vbyHat) + epsilon);

        // Why
        for (let j = 0; j < this.hiddenSize; j++) {
          const g_Why = dWhy[i][j] / timeSteps;
          this.m_Why[i][j] = beta1 * this.m_Why[i][j] + (1 - beta1) * g_Why;
          this.v_Why[i][j] = beta2 * this.v_Why[i][j] + (1 - beta2) * g_Why * g_Why;
          const mWhyHat = this.m_Why[i][j] / biasCorrection1;
          const vWhyHat = this.v_Why[i][j] / biasCorrection2;
          this.Why[i][j] += this.learningRate * mWhyHat / (Math.sqrt(vWhyHat) + epsilon);
        }
      }
      
      // Set model's hidden state to the final step of sequence
      this.hiddenState = hStates[timeSteps];
      
      return mse / (timeSteps * this.outputSize);
    }

    save() {
      return JSON.stringify({
        Wxh: this.Wxh,
        Whh: this.Whh,
        Why: this.Why,
        bh: this.bh,
        by: this.by
      });
    }

    load(jsonStr) {
      try {
        const data = JSON.parse(jsonStr);
        if (data.Wxh && data.Whh && data.Why && data.bh && data.by) {
          if (data.Wxh.length !== this.hiddenSize || data.Wxh[0].length !== this.inputSize) return false;
          if (data.Whh.length !== this.hiddenSize || data.Whh[0].length !== this.hiddenSize) return false;
          if (data.Why.length !== this.outputSize || data.Why[0].length !== this.hiddenSize) return false;
          if (data.bh.length !== this.hiddenSize) return false;
          if (data.by.length !== this.outputSize) return false;
          this.Wxh = data.Wxh;
          this.Whh = data.Whh;
          this.Why = data.Why;
          this.bh = data.bh;
          this.by = data.by;
          // Re-initialize moments
          this.t = 0;
          this.m_Wxh = Array(this.hiddenSize).fill(0).map(() => Array(this.inputSize).fill(0.0));
          this.v_Wxh = Array(this.hiddenSize).fill(0).map(() => Array(this.inputSize).fill(0.0));
          this.m_Whh = Array(this.hiddenSize).fill(0).map(() => Array(this.hiddenSize).fill(0.0));
          this.v_Whh = Array(this.hiddenSize).fill(0).map(() => Array(this.hiddenSize).fill(0.0));
          this.m_Why = Array(this.outputSize).fill(0).map(() => Array(this.hiddenSize).fill(0.0));
          this.v_Why = Array(this.outputSize).fill(0).map(() => Array(this.hiddenSize).fill(0.0));
          this.m_bh = Array(this.hiddenSize).fill(0.0);
          this.v_bh = Array(this.hiddenSize).fill(0.0);
          this.m_by = Array(this.outputSize).fill(0.0);
          this.v_by = Array(this.outputSize).fill(0.0);
          return true;
        }
      } catch (e) {
        console.error("SimpleRNN load error:", e);
      }
      return false;
    }
  }

  // --- UNIFIED SATTA AI PREDICTOR COORDINATOR ---
  class SattaAIPredictor {
    constructor() {
      this.models = {
        mines: new FeedForwardNN([53, 32, 25], 'tanh', 0.05),
        limbo: new SimpleRNN(5, 16, 3, 0.02),
        crash: new SimpleRNN(1, 12, 1, 0.02),
        blackjack: new FeedForwardNN([4, 16, 3], 'sigmoid', 0.02),
        roulette: new SimpleRNN(3, 12, 3, 0.02),
        baccarat: new SimpleRNN(2, 12, 2, 0.02),
        poker: new FeedForwardNN([4, 12, 1], 'sigmoid', 0.03),
        craps: new FeedForwardNN([3, 12, 2], 'sigmoid', 0.03)
      };

      this.stats = {
        mines: { games: 0, steps: 0, loss: 0.0, spawns: Array(25).fill(0), sessions: 0 },
        limbo: { games: 0, steps: 0, loss: 0.0 },
        crash: { games: 0, steps: 0, loss: 0.0 },
        blackjack: { games: 0, steps: 0, loss: 0.0 },
        roulette: { games: 0, steps: 0, loss: 0.0 },
        baccarat: { games: 0, steps: 0, loss: 0.0 },
        poker: { games: 0, steps: 0, loss: 0.0 },
        craps: { games: 0, steps: 0, loss: 0.0 }
      };

      this.replayBuffers = {
        mines: [],
        limbo: [],
        crash: [],
        blackjack: [],
        roulette: [],
        baccarat: [],
        poker: [],
        craps: []
      };

      this._saveDebouncers = {};
      this.loadAllModels();
    }

    // --- LocalStorage Persistence ---
    saveModel(game) {
      if (!this.models[game]) return;
      if (typeof localStorage === 'undefined' || !localStorage || typeof localStorage.setItem !== 'function') return;
      
      if (this._saveDebouncers[game]) {
        clearTimeout(this._saveDebouncers[game]);
      }
      this._saveDebouncers[game] = setTimeout(() => {
        try {
          localStorage.setItem(`st_nn_${game}`, this.models[game].save());
          localStorage.setItem(`st_nn_stats_${game}`, JSON.stringify(this.stats[game]));
          delete this._saveDebouncers[game];
        } catch (e) {
          console.warn(`Could not save AI weights for ${game}:`, e);
        }
      }, 100);
    }

    loadAllModels() {
      if (typeof localStorage === 'undefined' || !localStorage || typeof localStorage.getItem !== 'function') return;
      Object.keys(this.models).forEach(game => {
        try {
          const savedWeights = localStorage.getItem(`st_nn_${game}`);
          if (savedWeights) {
            this.models[game].load(savedWeights);
          }
          const savedStats = localStorage.getItem(`st_nn_stats_${game}`);
          if (savedStats) {
            const parsed = JSON.parse(savedStats);
            if (parsed && typeof parsed.games === 'number') {
              this.stats[game] = parsed;
              if (game === 'mines') {
                if (!this.stats.mines.spawns) this.stats.mines.spawns = Array(25).fill(0);
                if (typeof this.stats.mines.sessions !== 'number') this.stats.mines.sessions = 0;
              }
            }
          }
        } catch (e) {
          console.warn(`Error loading model for ${game}:`, e);
        }
      });
    }

    resetModel(game) {
      if (!this.models[game]) return;
      
      // Re-instantiate
      if (game === 'mines') this.models[game] = new FeedForwardNN([53, 32, 25], 'tanh', 0.05);
      else if (game === 'limbo') this.models[game] = new SimpleRNN(5, 16, 3, 0.02);
      else if (game === 'crash') this.models[game] = new SimpleRNN(1, 12, 1, 0.02);
      else if (game === 'blackjack') this.models[game] = new FeedForwardNN([4, 16, 3], 'sigmoid', 0.02);
      else if (game === 'roulette') this.models[game] = new SimpleRNN(3, 12, 3, 0.02);
      else if (game === 'baccarat') this.models[game] = new SimpleRNN(2, 12, 2, 0.02);
      else if (game === 'poker') this.models[game] = new FeedForwardNN([4, 12, 1], 'sigmoid', 0.03);
      else if (game === 'craps') this.models[game] = new FeedForwardNN([3, 12, 2], 'sigmoid', 0.03);

      if (game === 'mines') {
        this.stats[game] = { games: 0, steps: 0, loss: 0.0, spawns: Array(25).fill(0), sessions: 0 };
      } else {
        this.stats[game] = { games: 0, steps: 0, loss: 0.0 };
      }
      
      if (this.replayBuffers[game]) {
        this.replayBuffers[game] = [];
      }

      if (typeof localStorage !== 'undefined' && localStorage && typeof localStorage.removeItem === 'function') {
        try {
          localStorage.removeItem(`st_nn_${game}`);
          localStorage.removeItem(`st_nn_stats_${game}`);
        } catch (e) {}
      }
    }

    // --- Experience Replay Buffer Helper ---
    _addToBufferAndTrain(game, item) {
      if (!this.replayBuffers[game]) {
        this.replayBuffers[game] = [];
      }
      const buffer = this.replayBuffers[game];
      buffer.push(item);
      if (buffer.length > 100) {
        buffer.shift(); // rolling size limit 100
      }

      // Train on a random mini-batch of size 8
      const batchSize = Math.min(8, buffer.length);
      let totalLoss = 0;
      
      const indices = [];
      while (indices.length < batchSize) {
        const idx = Math.floor(Math.random() * buffer.length);
        if (!indices.includes(idx)) {
          indices.push(idx);
        }
      }

      for (let i = 0; i < batchSize; i++) {
        const sampled = buffer[indices[i]];
        let sampleLoss = 0;
        if (this.models[game] instanceof FeedForwardNN) {
          sampleLoss = this.models[game].trainOnline(sampled.inputs, sampled.targets);
        } else {
          sampleLoss = this.models[game].trainSequence(sampled.sequence, sampled.targets);
        }
        totalLoss += sampleLoss;
      }

      const avgLoss = totalLoss / batchSize;
      if (!this.lossHistory) this.lossHistory = { all: [] };
      if (!this.lossHistory[game]) this.lossHistory[game] = [];
      this.lossHistory[game].push(avgLoss);
      this.lossHistory.all.push(avgLoss);
      if (this.lossHistory[game].length > 40) this.lossHistory[game].shift();
      if (this.lossHistory.all.length > 50) this.lossHistory.all.shift();
      return avgLoss;
    }

    drawLossCurve(canvasId, game = 'all') {
      const canvas = document.getElementById(canvasId);
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      ctx.fillStyle = '#060a16';
      ctx.fillRect(0, 0, w, h);

      const hist = (this.lossHistory && this.lossHistory[game]) ? this.lossHistory[game] : [];
      if (!hist.length) {
        ctx.fillStyle = '#64748b';
        ctx.font = '10px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('Awaiting neural net backprop training iterations...', w / 2, h / 2 + 3);
        return;
      }

      const pad = { top: 12, bottom: 16, left: 30, right: 12 };
      const cw = w - pad.left - pad.right;
      const ch = h - pad.top - pad.bottom;
      const maxVal = Math.max(0.2, Math.max(...hist) * 1.15);
      const minVal = 0;

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.lineWidth = 1;
      for (let i = 0; i <= 2; i++) {
        const y = pad.top + (i / 2) * ch;
        ctx.beginPath();
        ctx.moveTo(pad.left, y);
        ctx.lineTo(w - pad.right, y);
        ctx.stroke();
      }

      ctx.strokeStyle = '#c084fc';
      ctx.lineWidth = 2;
      ctx.beginPath();
      hist.forEach((v, idx) => {
        const x = pad.left + (idx / Math.max(1, hist.length - 1)) * cw;
        const y = pad.top + ch - ((v - minVal) / (maxVal - minVal)) * ch;
        if (idx === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();

      const grad = ctx.createLinearGradient(0, pad.top, 0, h - pad.bottom);
      grad.addColorStop(0, 'rgba(192, 132, 252, 0.2)');
      grad.addColorStop(1, 'rgba(192, 132, 252, 0.0)');
      ctx.fillStyle = grad;
      ctx.lineTo(pad.left + cw, pad.top + ch);
      ctx.lineTo(pad.left, pad.top + ch);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = '#c084fc';
      ctx.font = 'bold 9px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(`Loss: ${hist[hist.length - 1].toFixed(4)} (MSE)`, pad.left + 4, pad.top + 8);
    }

    // --- GAME SPECIFIC APIS ---

    // 1. Mines
    // Inputs: grid (25: 0=unrevealed, 1=gem, -1=mine), minesCount, uncoveredCount
    // Outputs: probability of safe tile for all 25 tiles
    _minesFeatures(revealedStates, mineLocations, minesCount) {
      const tileStates = Array(25).fill(0.0);
      for (let i = 0; i < 25; i++) {
        if (revealedStates[i]) {
          tileStates[i] = (mineLocations && mineLocations.includes(i)) ? -1.0 : 1.0;
        }
      }
      const total = Math.max(1, this.stats.mines.sessions || 0);
      const spawns = this.stats.mines.spawns || Array(25).fill(0);
      const spawnNorm = spawns.map(c => c / total);
      
      const f = [...tileStates, ...spawnNorm];
      f.push(minesCount / 24);
      f.push(revealedStates.filter(s => s).length / 25);
      f.push(revealedStates.filter(s => !s).length / 25);
      return f; // length = 53
    }

    predictMines(revealedStates, mineLocations, minesCount) {
      const inputs = this._minesFeatures(revealedStates, mineLocations, minesCount);
      const outputs = this.models.mines.forward(inputs);
      const finalProbs = outputs[outputs.length - 1];

      // Exclude revealed tiles, and add a micro-scale Softmax exploration noise to prevent predicting index 0 repeatedly on equal weights
      const adjustedProbs = finalProbs.map((prob, i) => {
        if (revealedStates[i]) return -Infinity;
        const noise = (Math.random() - 0.5) * 1e-5; // tiny tie-breaker
        return prob + noise;
      });

      let bestIdx = -1;
      let maxProb = -Infinity;
      for (let i = 0; i < 25; i++) {
        if (adjustedProbs[i] > maxProb) {
          maxProb = adjustedProbs[i];
          bestIdx = i;
        }
      }

      // Empirical safety mapped between 10% and 99%
      let safetyPct = 50;
      if (bestIdx !== -1) {
        const rawScore = finalProbs[bestIdx]; // in range [0, 1] due to tanh or mapped sigmoid
        const normalizedScore = (rawScore + 1) / 2; // map tanh [-1,1] to [0,1]
        safetyPct = Math.round(Math.max(10, Math.min(99, normalizedScore * 100)));
      }

      const row = Math.floor(bestIdx / 5) + 1;
      const col = (bestIdx % 5) + 1;
      
      return {
        tileIndex: bestIdx,
        row,
        col,
        safetyPct
      };
    }

    learnMines(mineLocations) {
      if (!this.stats.mines.spawns) this.stats.mines.spawns = Array(25).fill(0);
      if (typeof this.stats.mines.sessions !== 'number') this.stats.mines.sessions = 0;

      this.stats.mines.sessions++;
      mineLocations.forEach(idx => {
        if (idx >= 0 && idx < 25) {
          this.stats.mines.spawns[idx]++;
        }
      });

      // Train on complete board layout
      // Target: 0.0 for mines, 1.0 for gems
      const revealedStates = Array(25).fill(false); // before clicks
      const inputs = this._minesFeatures(revealedStates, mineLocations, mineLocations.length);

      const targets = Array(25).fill(1.0);
      mineLocations.forEach(idx => {
        if (idx >= 0 && idx < 25) targets[idx] = 0.0;
      });

      const loss = this._addToBufferAndTrain('mines', { inputs, targets });
      this.stats.mines.games++;
      this.stats.mines.steps++;
      this.stats.mines.loss = this.stats.mines.loss * 0.9 + loss * 0.1;
      this.saveModel('mines');
    }

    // 2. Limbo
    // Inputs: last 10 rolls & states (outcome, isWin, streakCount, accumulatedLoss, limboProfit)
    predictLimbo(pastRolls, target = 2.0, baseBet = 10, streakCount = 0, accumulatedLoss = 0, limboProfit = 0) {
      const model = this.models.limbo;
      model.resetState();

      const getObj = (item) => {
        if (typeof item === 'object' && item !== null) {
          return {
            outcome: item.outcome ?? 1.5,
            target: item.target ?? 2.0,
            streakCount: item.streakCount ?? 0,
            accumulatedLoss: item.accumulatedLoss ?? 0,
            limboProfit: item.limboProfit ?? 0,
            wager: item.wager ?? baseBet
          };
        }
        return {
          outcome: typeof item === 'number' ? item : 1.5,
          target: 2.0,
          streakCount: 0,
          accumulatedLoss: 0,
          limboProfit: 0,
          wager: baseBet
        };
      };

      const rolls = pastRolls.map(getObj);
      while (rolls.length < 10) {
        rolls.unshift({
          outcome: 1.5,
          target: 2.0,
          streakCount: 0,
          accumulatedLoss: 0,
          limboProfit: 0,
          wager: baseBet
        });
      }

      const getFeatures = (item) => {
        const normRoll = Math.log(Math.max(1.0, item.outcome)) / 10.0;
        const isWin = item.outcome >= item.target ? 1.0 : 0.0;
        const normStreak = Math.min(10, item.streakCount) / 10.0;
        const normLoss = Math.log(Math.max(1.0, item.accumulatedLoss / Math.max(1, baseBet))) / 5.0;
        const normProfit = Math.tanh(item.limboProfit / Math.max(1, baseBet * 20.0));
        return [normRoll, isWin, normStreak, normLoss, normProfit];
      };

      const sequence = [];
      for (let i = 0; i < rolls.length; i++) {
        sequence.push(getFeatures(rolls[i]));
      }

      // Add current active state as final sequence step
      const currentIsWin = (rolls[rolls.length - 1].outcome >= rolls[rolls.length - 1].target) ? 1.0 : 0.0;
      sequence.push([
        Math.log(Math.max(1.0, rolls[rolls.length - 1].outcome)) / 10.0,
        currentIsWin,
        Math.min(10, streakCount) / 10.0,
        Math.log(Math.max(1.0, accumulatedLoss / Math.max(1, baseBet))) / 5.0,
        Math.tanh(limboProfit / Math.max(1, baseBet * 20.0))
      ]);

      let outputs = [];
      for (let i = 0; i < sequence.length; i++) {
        outputs = model.forward(sequence[i]);
      }
      
      const predLogVal = outputs[0] || 0.1;
      const optTargetNorm = outputs[1] || 0.2;
      const optBetNorm = outputs[2] || 0.2;

      // De-normalize outputs
      const predictedMultiplier = Math.exp(predLogVal * 10.0);
      let targetVal = Math.exp(optTargetNorm * 4.0);
      let recommendedWager = baseBet * (0.1 + optBetNorm * 4.9);

      targetVal = Math.round(Math.max(1.01, Math.min(99.0, targetVal)) * 100) / 100;
      recommendedWager = Math.round(Math.max(baseBet * 0.1, recommendedWager) * 100) / 100;

      let riskLevel = "STABLE";
      let riskColor = "#a855f7"; // Purple
      let targetAdvice = `AI RECOMMENDED TARGET (${targetVal.toFixed(2)}x)`;
      let capitalAdvice = `AI RECOMMENDED WAGER: $${recommendedWager.toFixed(2)}`;
      let betRecommendation = "NEUTRAL WAGER (Maintain)";

      if (streakCount >= 1) {
        riskLevel = `DEFENSIVE (Streak: ${streakCount})`;
        riskColor = "#f43f5e"; // Crimson
        betRecommendation = "DECREASE WAGER / INCREASE MULTIPLIER (RNN Recovery)";
      } else if (predictedMultiplier > 4.0) {
        riskLevel = "OFFENSIVE (Breakout Predicted)";
        riskColor = "#00f2fe"; // Cyan
        betRecommendation = "INCREASE BET (Exploit Breakout)";
      } else if (limboProfit > baseBet * 10) {
        riskLevel = "OFFENSIVE (Profit Compounding)";
        riskColor = "#10b981"; // Emerald
        betRecommendation = "SCALE UP WAGER (Compounding Wins)";
      }

      return {
        predictedMultiplier,
        targetVal,
        recommendedWager,
        riskLevel,
        targetAdvice,
        capitalAdvice,
        betRecommendation,
        riskColor
      };
    }

    learnLimbo(pastRolls, actualOutcome, target = 2.0, streakCount = 0, accumulatedLoss = 0, limboProfit = 0, wager = 10) {
      const baseBet = wager || 10;
      
      const getObj = (item) => {
        if (typeof item === 'object' && item !== null) {
          return {
            outcome: item.outcome ?? 1.5,
            target: item.target ?? 2.0,
            streakCount: item.streakCount ?? 0,
            accumulatedLoss: item.accumulatedLoss ?? 0,
            limboProfit: item.limboProfit ?? 0,
            wager: item.wager ?? baseBet
          };
        }
        return {
          outcome: typeof item === 'number' ? item : 1.5,
          target: 2.0,
          streakCount: 0,
          accumulatedLoss: 0,
          limboProfit: 0,
          wager: baseBet
        };
      };

      const rolls = pastRolls.map(getObj);
      while (rolls.length < 10) {
        rolls.unshift({
          outcome: 1.5,
          target: 2.0,
          streakCount: 0,
          accumulatedLoss: 0,
          limboProfit: 0,
          wager: baseBet
        });
      }

      const getFeatures = (item) => {
        const normRoll = Math.log(Math.max(1.0, item.outcome)) / 10.0;
        const isWin = item.outcome >= item.target ? 1.0 : 0.0;
        const normStreak = Math.min(10, item.streakCount) / 10.0;
        const normLoss = Math.log(Math.max(1.0, item.accumulatedLoss / Math.max(1, baseBet))) / 5.0;
        const normProfit = Math.tanh(item.limboProfit / Math.max(1, baseBet * 20.0));
        return [normRoll, isWin, normStreak, normLoss, normProfit];
      };

      const getNormTarget = (nextRoll, streak, accLoss, profit, w) => {
        let optTarget = 1.05;
        let optBet = baseBet * 0.1;

        if (nextRoll >= 1.2) {
          optTarget = Math.max(1.2, Math.min(20.0, nextRoll * 0.85));
          if (streak > 0) {
            optBet = (accLoss / (optTarget - 1)) + (baseBet * 0.5);
          } else {
            if (profit > baseBet * 10) {
              optBet = baseBet * 2.0;
            } else {
              optBet = baseBet * 1.2;
            }
          }
        } else {
          optTarget = 1.05;
          optBet = baseBet * 0.1;
        }

        const nextRollNorm = Math.log(Math.max(1.0, nextRoll)) / 10.0;
        const optTargetNorm = Math.min(1.0, Math.max(0.0, Math.log(Math.max(1.0, optTarget)) / 4.0));
        const optBetNorm = Math.min(1.0, Math.max(0.0, (optBet / Math.max(1, baseBet) - 0.1) / 4.9));

        return [nextRollNorm, optTargetNorm, optBetNorm];
      };

      const sequence = [];
      const targets = [];

      for (let i = 0; i < rolls.length - 1; i++) {
        sequence.push(getFeatures(rolls[i]));
        const nextRoll = rolls[i + 1];
        targets.push(getNormTarget(
          nextRoll.outcome,
          rolls[i].streakCount,
          rolls[i].accumulatedLoss,
          rolls[i].limboProfit,
          rolls[i].wager
        ));
      }
      
      sequence.push(getFeatures(rolls[rolls.length - 1]));
      targets.push(getNormTarget(
        actualOutcome,
        rolls[rolls.length - 1].streakCount,
        rolls[rolls.length - 1].accumulatedLoss,
        rolls[rolls.length - 1].limboProfit,
        rolls[rolls.length - 1].wager
      ));

      const loss = this._addToBufferAndTrain('limbo', { sequence, targets });
      this.stats.limbo.games++;
      this.stats.limbo.steps++;
      this.stats.limbo.loss = this.stats.limbo.loss * 0.9 + loss * 0.1;
      this.saveModel('limbo');
    }

    // 3. Crash
    predictCrash(pastCrashes) {
      const model = this.models.crash;
      model.resetState();
      
      const normCrash = c => Math.log(Math.max(1.0, c)) / 10.0;
      const crashes = [...pastCrashes];
      while (crashes.length < 10) crashes.unshift(1.5);

      const sequence = [];
      for (let i = 0; i < crashes.length; i++) {
        sequence.push([normCrash(crashes[i])]);
      }

      let outputs = [];
      for (let i = 0; i < sequence.length; i++) {
        outputs = model.forward(sequence[i]);
      }
      
      const predLogVal = outputs[0] || 0.1;
      const predictedCrash = Math.exp(predLogVal * 10.0);

      let riskLevel = "MEDIUM RISK";
      let color = "#eab308";
      let recCashout = Math.min(predictedCrash, 1.80);

      if (predictedCrash < 1.30) {
        riskLevel = "HIGH RISK (Bust Alert)";
        color = "#f43f5e";
        recCashout = 1.15;
      } else if (predictedCrash > 3.00) {
        riskLevel = "LOW RISK (Opportunity)";
        color = "#10b981";
        recCashout = 2.50;
      }

      return {
        predictedCrash,
        riskLevel,
        color,
        recCashout
      };
    }

    learnCrash(pastCrashes, actualCrash) {
      const normCrash = c => Math.log(Math.max(1.0, c)) / 10.0;
      const crashes = [...pastCrashes];
      while (crashes.length < 10) crashes.unshift(1.5);

      const sequence = [];
      const targets = [];

      for (let i = 0; i < crashes.length - 1; i++) {
        sequence.push([normCrash(crashes[i])]);
        targets.push([normCrash(crashes[i + 1])]);
      }
      sequence.push([normCrash(crashes[crashes.length - 1])]);
      targets.push([normCrash(actualCrash)]);

      const loss = this._addToBufferAndTrain('crash', { sequence, targets });
      this.stats.crash.games++;
      this.stats.crash.steps++;
      this.stats.crash.loss = this.stats.crash.loss * 0.9 + loss * 0.1;
      this.saveModel('crash');
    }

    // 4. Blackjack
    predictBlackjack(playerTotal, dealerUpcardVal, trueCount, isSoft) {
      const inputs = [
        playerTotal / 30,
        dealerUpcardVal / 11,
        trueCount / 10,
        isSoft ? 1.0 : 0.0
      ];

      const layerOutputs = this.models.blackjack.forward(inputs);
      const outputs = layerOutputs[layerOutputs.length - 1]; // [pHit, pStand, pDouble]

      let action = 'H';
      let actionText = 'Hit';
      
      const sortedIdx = [0, 1, 2].sort((a,b) => outputs[b] - outputs[a]);
      const bestActionIdx = sortedIdx[0];

      if (bestActionIdx === 0) { action = 'H'; actionText = 'Hit'; }
      else if (bestActionIdx === 1) { action = 'S'; actionText = 'Stand'; }
      else if (bestActionIdx === 2) { action = 'D'; actionText = 'Double Down'; }

      const rawWinProb = outputs[bestActionIdx];
      const winPercentage = Math.round(Math.max(5, Math.min(95, rawWinProb * 100)));

      return {
        action,
        actionText,
        winPercentage,
        explanation: `AI Neural Net predicted action ${actionText} with ${winPercentage}% winning probability based on hand parameters.`
      };
    }

    learnBlackjack(playerTotal, dealerUpcardVal, trueCount, isSoft, actionChosen, handOutcome) {
      // actionChosen: 'H'=0, 'S'=1, 'D'=2
      // handOutcome: Win=1.0, Push=0.5, Loss=0.0
      const inputs = [
        playerTotal / 30,
        dealerUpcardVal / 11,
        trueCount / 10,
        isSoft ? 1.0 : 0.0
      ];

      let actionIdx = 0;
      if (actionChosen === 'S' || actionChosen === 'Stand') actionIdx = 1;
      else if (actionChosen === 'D' || actionChosen === 'Double Down') actionIdx = 2;

      // Create target vector. We only backprop error for the chosen action
      const layerOutputs = this.models.blackjack.forward(inputs);
      const targets = [...layerOutputs[layerOutputs.length - 1]];
      targets[actionIdx] = handOutcome; // update output target for chosen action

      const loss = this._addToBufferAndTrain('blackjack', { inputs, targets });
      this.stats.blackjack.games++;
      this.stats.blackjack.steps++;
      this.stats.blackjack.loss = this.stats.blackjack.loss * 0.9 + loss * 0.1;
      this.saveModel('blackjack');
    }

    // 5. Roulette
    predictRoulette(pastOutcomes) {
      // pastOutcomes: Array of spun colors ('R', 'B', 'G')
      const model = this.models.roulette;
      model.resetState();
      
      const colorToVec = c => c === 'R' ? [1,0,0] : (c === 'B' ? [0,1,0] : [0,0,1]);
      
      const sequence = [];
      const history = [...pastOutcomes];
      while (history.length < 10) history.unshift('R');

      for (let i = 0; i < history.length; i++) {
        sequence.push(colorToVec(history[i]));
      }

      let outputs = [];
      for (let i = 0; i < sequence.length; i++) {
        outputs = model.forward(sequence[i]);
      }

      const pRed = outputs[0] || 0.33;
      const pBlack = outputs[1] || 0.33;
      const pGreen = outputs[2] || 0.33;
      
      const maxP = Math.max(pRed, pBlack, pGreen);
      let predictedColor = 'R';
      if (maxP === pBlack) predictedColor = 'B';
      if (maxP === pGreen) predictedColor = 'G';

      return {
        predictedColor,
        probabilities: { Red: pRed, Black: pBlack, Green: pGreen }
      };
    }

    learnRoulette(pastOutcomes, actualOutcome) {
      const colorToVec = c => c === 'R' ? [1,0,0] : (c === 'B' ? [0,1,0] : [0,0,1]);
      const history = [...pastOutcomes];
      while (history.length < 10) history.unshift('R');

      const sequence = [];
      const targets = [];

      for (let i = 0; i < history.length - 1; i++) {
        sequence.push(colorToVec(history[i]));
        targets.push(colorToVec(history[i + 1]));
      }
      sequence.push(colorToVec(history[history.length - 1]));
      targets.push(colorToVec(actualOutcome));

      const loss = this._addToBufferAndTrain('roulette', { sequence, targets });
      this.stats.roulette.games++;
      this.stats.roulette.steps++;
      this.stats.roulette.loss = this.stats.roulette.loss * 0.9 + loss * 0.1;
      this.saveModel('roulette');
    }

    // 6. Baccarat
    predictBaccarat(pastOutcomes) {
      // outcomes: 'B', 'P', 'T'
      const model = this.models.baccarat;
      model.resetState();

      const outcomeToVec = o => o === 'B' ? [1,0] : [0,1];
      const history = pastOutcomes.filter(o => o !== 'T'); // skip ties for RNN sequence simplicity
      while (history.length < 10) history.unshift('B');

      const sequence = [];
      for (let i = 0; i < history.length; i++) {
        sequence.push(outcomeToVec(history[i]));
      }

      let outputs = [];
      for (let i = 0; i < sequence.length; i++) {
        outputs = model.forward(sequence[i]);
      }

      const pBanker = outputs[0] || 0.5;
      const pPlayer = outputs[1] || 0.5;

      const recommendedBet = pBanker >= pPlayer ? 'B' : 'P';

      return {
        recommendedBet,
        probabilities: { Banker: pBanker, Player: pPlayer }
      };
    }

    learnBaccarat(pastOutcomes, actualOutcome) {
      if (actualOutcome === 'T') return; // ignore tie for training
      
      const outcomeToVec = o => o === 'B' ? [1,0] : [0,1];
      const history = pastOutcomes.filter(o => o !== 'T');
      while (history.length < 10) history.unshift('B');

      const sequence = [];
      const targets = [];

      for (let i = 0; i < history.length - 1; i++) {
        sequence.push(outcomeToVec(history[i]));
        targets.push(outcomeToVec(history[i + 1]));
      }
      sequence.push(outcomeToVec(history[history.length - 1]));
      targets.push(outcomeToVec(actualOutcome));

      const loss = this._addToBufferAndTrain('baccarat', { sequence, targets });
      this.stats.baccarat.games++;
      this.stats.baccarat.steps++;
      this.stats.baccarat.loss = this.stats.baccarat.loss * 0.9 + loss * 0.1;
      this.saveModel('baccarat');
    }

    // 7. Poker
    predictPoker(handStrengthVal, mathEquity, potOdds) {
      const inputs = [
        handStrengthVal / 10,
        mathEquity / 100,
        potOdds / 100,
        (mathEquity > potOdds) ? 1.0 : 0.0
      ];

      const outputs = this.models.poker.forward(inputs);
      const score = outputs[outputs.length - 1][0] || 0.5;

      let actionText = "CHECK / FOLD";
      if (score > 0.65) actionText = "RAISE (AI Value Bet)";
      else if (score > 0.45) actionText = "CALL / CHECK (AI Safe Play)";

      return {
        winEquity: Math.round(score * 100),
        actionText
      };
    }

    learnPoker(handStrengthVal, mathEquity, potOdds, wonHand) {
      const inputs = [
        handStrengthVal / 10,
        mathEquity / 100,
        potOdds / 100,
        (mathEquity > potOdds) ? 1.0 : 0.0
      ];
      
      const targets = [wonHand ? 1.0 : 0.0];
      const loss = this._addToBufferAndTrain('poker', { inputs, targets });
      this.stats.poker.games++;
      this.stats.poker.steps++;
      this.stats.poker.loss = this.stats.poker.loss * 0.9 + loss * 0.1;
      this.saveModel('poker');
    }

    // 8. Craps
    predictCraps(phaseStr, pointNum, betTypeStr) {
      // phaseStr: 'Come-out' = 0.0, 'Point' = 1.0
      // betTypeStr: Pass Line, Don't Pass, Odds, etc.
      const inputs = [
        phaseStr === 'Come-out Roll' ? 0.0 : 1.0,
        pointNum / 12,
        betTypeStr.includes('Pass') ? 1.0 : 0.0
      ];

      const outputs = this.models.craps.forward(inputs);
      const score = outputs[outputs.length - 1]; // [winProb, safetyScore]
      const winPercentage = Math.round((score[0] || 0.5) * 100);

      return {
        winPercentage,
        recommended: score[1] > 0.5
      };
    }

    learnCraps(phaseStr, pointNum, betTypeStr, wonBet) {
      const inputs = [
        phaseStr === 'Come-out Roll' ? 0.0 : 1.0,
        pointNum / 12,
        betTypeStr.includes('Pass') ? 1.0 : 0.0
      ];

      const targets = [wonBet ? 1.0 : 0.0, wonBet ? 1.0 : 0.0];
      const loss = this._addToBufferAndTrain('craps', { inputs, targets });
      this.stats.craps.games++;
      this.stats.craps.steps++;
      this.stats.craps.loss = this.stats.craps.loss * 0.9 + loss * 0.1;
      this.saveModel('craps');
    }
  }

  // Export to global window scope
  window.SattaAIPredictor = new SattaAIPredictor();
})();
