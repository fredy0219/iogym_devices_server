class Client{

    constructor(app_id){
        this._app_id = app_id;
        this._device_type;
        this._created_time = Math.floor(Date.now() / 1000)
        this._training_result = {'set_number': 0,
                                    'weight' : 0,
                                    'work_type': "",
                                    'times': 0,
                                    'training_time':0,
                                    'rest_time':0};
        this._callback = undefined;
        this._current_state = process.env.SELECTING_WORKOUT;

    }
    

    get app_id(){
        return this._app_id;
    }

    get device_type(){
        return this._device_type;
    }
    

    set weight( weight){
        this._training_result.weight = weight;
    }

    get weight(){
        return this._training_result.weight;
    }
    
    set work_type( work_type){
        this._training_result.work_type = work_type;
    }
    
    set training_process(training_process){
        this._training_result.times = training_process.times;
        this._training_result.training_time = training_process.training_time;
        this._training_result.rest_time = training_process.rest_time;
    }

    get training_result(){
        return this._training_result;
    }

    reset(){
        this._training_result = {'set_number': 0,
            'weight' : 0,
            'work_type': "",
            'times': 0,
            'training_time':0,
            'rest_time':0};
    }
    
    reset_last_training_result(){
        this._training_result.times = 0;
        this._training_result.training_time = 0;
        this._training_result.rest_time = 0;
    }

    set callback( callback){
        this._callback = callback;
    }

    get callback(){
        return this._callback;
    }

    set current_state( current_state){
        this._current_state = current_state;
    }

    get current_state(){
        return this._current_state;
    }

};

class Cable extends Client{
    constructor(app_id){
        super(app_id);
        this._cable_weight = 0;
        this._cable_weight_queue = new Array();
    }

    set_cable(cable_weight){
        this._cable_weight = cable_weight
        this._cable_weight_queue.push({weight: cable_weight})
    }

    delete_cable(){
        this._barbell_weight = 0;
    }

    get cable_weight_queue(){
        return this._cable_weight_queue;
    }

    
}

class Dumbbell extends Client{

    constructor(app_id){
        super(app_id);
        this._dumbbell_weight_dict = []
        this._dumbbell_weight_queue = []
        
    }

    add_dumbbell(new_dumbbell){
        
        this._dumbbell_weight_map = new Map()
        if(typeof new_dumbbell.weight === undefined || typeof new_dumbbell.timestamp === undefined){
            return;
        }else{
            // this._dumbbell_weight_map.set(new_dumbbell.weight, new_dumbbell.timestamp);
            // this._dumbbell_weight_queue.push(new_dumbbell);

            this._dumbbell_weight_dict[new_dumbbell.timestamp] = new_dumbbell.weight;
            this._dumbbell_weight_queue.push(this._dumbbell_weight_dict);
            

        }
    }


    get dumbell_weight_queue(){
        return this._dumbbell_weight_queue;
    }

}

class Barbell extends Client{

    constructor(app_id){
        super(app_id);
        this._barbell_weight = 0;
        this._barbell_weight_queue = new Array();
    }
    set_barbell(barbell_weight){
        this._barbell_weight = barbell_weight
        this._barbell_weight_queue.push({weight: barbell_weight})
    }

    delete_barbell(){
        this._barbell_weight = 0;
    }

    get barbell_weight_queue(){
        return this._barbell_weight_queue
    }

}

module.exports = {
    Cable : Cable,
    Dumbbell : Dumbbell,
    Barbell : Barbell}